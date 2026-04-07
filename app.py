import re
import threading
from rank_bm25 import BM25Okapi
import os
import json
import uuid
import threading
import webview
from flask import Flask, render_template, jsonify, request
from flask import redirect, url_for

import sys

# Глобальные переменные для поиска
bm25_index = None
page_ids = []
page_titles = []

def resource_path(relative_path):
    """Путь для статических ресурсов (templates, static) – внутри exe."""
    try:
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

def data_path(relative_path):
    """Путь для данных (pages.json) – рядом с exe или в рабочей папке."""
    if getattr(sys, 'frozen', False):
        # Запущено как exe – сохраняем рядом с исполняемым файлом
        base_path = os.path.dirname(sys.executable)
    else:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

# ---- Конфигурация ----
PAGES_PATH = data_path("pages.json")   # <-- теперь данные будут сохраняться рядом с exe
template_folder = resource_path("templates")
static_folder = resource_path("static")

app = Flask(__name__, template_folder=template_folder, static_folder=static_folder)

# ---- Функции работы со страницами (полностью из твоего кода) ----
def load_pages():
    if not os.path.exists(PAGES_PATH):
        return {"pages": []}
    with open(PAGES_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def save_pages(data):
    with open(PAGES_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def get_page(data, page_id):
    for p in data["pages"]:
        if p["id"] == page_id:
            return p
    return None

def build_tree(pages):
    by_id = {p["id"]: {**p, "children": []} for p in pages}
    roots = []
    for p in by_id.values():
        pid = p.get("parent_id")
        if pid and pid in by_id:
            by_id[pid]["children"].append(p)
        else:
            roots.append(p)
    return roots

# ---- Flask роуты (полностью из твоего кода) ----
@app.route("/")
def home():
    data = load_pages()
    page = get_page(data, "personal-home") or (data["pages"][0] if data["pages"] else None)
    if not page:
        return "No pages defined", 500
    return render_page(data, page)

@app.route("/page/<page_id>")
def page_view(page_id):
    data = load_pages()
    page = get_page(data, page_id)
    if not page:
        # Перенаправляем на главную, которая покажет первую страницу
        return redirect(url_for('home'))
    return render_page(data, page)

@app.route("/api/page/<page_id>", methods=["GET"])
def api_get_page(page_id):
    data = load_pages()
    page = get_page(data, page_id)
    if not page:
        return jsonify({"error": "not found"}), 404
    return jsonify(page)

@app.route("/api/page/<page_id>", methods=["POST"])
def api_save_page(page_id):
    data = load_pages()
    page = get_page(data, page_id)
    if not page:
        return jsonify({"error": "not found"}), 404
    payload = request.get_json(force=True)
    page["title"] = payload.get("title", page["title"])
    page["icon"] = payload.get("icon", page.get("icon"))
    page["blocks"] = payload.get("blocks", page.get("blocks", []))
    page["cover_color"] = payload.get("cover_color", page.get("cover_color", "#252525"))
    save_pages(data)
    build_search_index()
    return jsonify({"status": "ok"})

@app.route("/api/pages/new", methods=["POST"])
def api_new_page():
    data = load_pages()
    payload = request.get_json(force=True) if request.data else {}
    parent_id = payload.get("parent_id")
    new_id = str(uuid.uuid4())[:8]
    new_page = {
        "id": new_id,
        "title": "Untitled",
        "icon": "📄",
        "parent_id": parent_id,
        "blocks": [],
        "cover_color": "#252525"
    }
    data["pages"].append(new_page)
    save_pages(data)
    build_search_index()
    return jsonify({"status": "ok", "page": new_page})

@app.route("/api/page/<page_id>", methods=["DELETE"])
def api_delete_page(page_id):
    data = load_pages()
    if not data.get("pages"):
        return jsonify({"error": "no pages"}), 400
    page_ids_to_delete = set()
    def collect_ids(pid):
        page_ids_to_delete.add(pid)
        for p in data["pages"]:
            if p.get("parent_id") == pid:
                collect_ids(p["id"])
    collect_ids(page_id)
    remaining = [p for p in data["pages"] if p["id"] not in page_ids_to_delete]
    if not remaining:
        return jsonify({"error": "cannot_delete_last_page"}), 400
    data["pages"] = remaining
    save_pages(data)
    build_search_index()
    return jsonify({"status": "ok"})

@app.route("/api/pages", methods=["GET"])
def api_list_pages():
    data = load_pages()
    return jsonify({"pages": [{"id": p["id"], "title": p["title"]} for p in data.get("pages", [])]})

def extract_text_from_page(page):
    """Рекурсивно собирает весь текст из блоков страницы"""
    texts = []
    # Добавляем заголовок и иконку (как слова)
    texts.append(page.get("title", ""))
    icon = page.get("icon", "")
    if icon and icon != "📄":
        texts.append(icon)  # эмодзи тоже может быть ключом

    # Обрабатываем блоки
    blocks = page.get("blocks", [])
    for block in blocks:
        if block.get("type") == "text":
            texts.append(block.get("text", ""))
        elif block.get("type") == "heading":
            texts.append(block.get("text", ""))
        elif block.get("type") == "todo":
            texts.append(block.get("text", ""))
        elif block.get("type") == "page":
            texts.append(block.get("text", ""))
        elif block.get("type") == "divider":
            pass  # разделитель не даёт текста
        elif block.get("type") == "columns":
            # Рекурсивно обходим колонки
            for col in block.get("columns", []):
                for inner_block in col.get("blocks", []):
                    if inner_block.get("type") == "text":
                        texts.append(inner_block.get("text", ""))
                    elif inner_block.get("type") == "heading":
                        texts.append(inner_block.get("text", ""))
                    elif inner_block.get("type") == "todo":
                        texts.append(inner_block.get("text", ""))
                    elif inner_block.get("type") == "page":
                        texts.append(inner_block.get("text", ""))
    # Объединяем все тексты в одну строку
    return " ".join(texts)

def build_search_index():
    global bm25_index, page_ids, page_titles
    data = load_pages()
    pages = data.get("pages", [])
    corpus = []
    ids = []
    titles = []
    for page in pages:
        text = extract_text_from_page(page)
        # Токенизация: разбиваем на слова, приводим к нижнему регистру, убираем знаки препинания
        tokens = re.findall(r'\w+', text.lower())
        if tokens:  # только непустые страницы
            corpus.append(tokens)
            ids.append(page["id"])
            titles.append(page["title"])
    if corpus:
        bm25_index = BM25Okapi(corpus)
        page_ids = ids
        page_titles = titles
    else:
        bm25_index = None
        page_ids = []
        page_titles = []

@app.route("/api/search")
def api_search():
    q = request.args.get("q", "").strip()
    if not q or bm25_index is None:
        return jsonify({"results": []})
    # Токенизируем запрос
    query_tokens = re.findall(r'\w+', q.lower())
    if not query_tokens:
        return jsonify({"results": []})
    # Получаем оценки BM25
    scores = bm25_index.get_scores(query_tokens)
    # Сортируем страницы по убыванию релевантности
    indexed = list(enumerate(scores))
    indexed.sort(key=lambda x: x[1], reverse=True)
    # Берём топ-20
    results = []
    for idx, score in indexed[:20]:
        if score > 0:
            results.append({
                "id": page_ids[idx],
                "title": page_titles[idx],
                "score": round(score, 2)
            })
    return jsonify({"results": results})

# ---- Функция рендера шаблона (будет позже, пока заглушка) ----
def render_page(data, page):
    tree = build_tree(data["pages"])
    return render_template("index.html", data=data, page=page, tree=tree)

# ---- Запуск Flask в отдельном потоке + webview ----
def run_flask():
    app.run(port=5000, debug=False, use_reloader=False)


if __name__ == "__main__":
    # Построить поисковый индекс при старте
    build_search_index()
    # Запускаем Flask в фоновом потоке
    flask_thread = threading.Thread(target=run_flask, daemon=True)
    flask_thread.start()

    # Импортируем webview и открываем окно
    
    webview.create_window("Personal Notion", "http://127.0.0.1:5000", width=1200, height=800, resizable=True)
    webview.start()