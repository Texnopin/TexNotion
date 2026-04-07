let activeDrawingBlock = null;
let drawingCanvas = null;
let fabricCanvas = null;
let currentTool = 'pen';
let currentColor = '#FFFFFF';
let currentBrushSize = 5;



// Глобальный флаг, какой блок сейчас в режиме редактирования
let activeEditingDrawingBlock = null;

// Глобальный массив цветов (шапка + белый/чёрный для рисования)
const DRAWING_COLORS = [
  "#FFFFFF", "#000000",           // белый и чёрный первыми
  "#252525", "#1e293b", "#0f766e", "#9575CD",
  "#6d28d9", "#81C784", "#FFF176", "#FF8A65",
  "#EF5350", "#004D40"
];








// function bindDrawingEvents() {
//   if (eventsBound) return;
//   eventsBound = true;
  
//   // Ползунок размера
//   const sizeSlider = document.getElementById('brushSizeSlider');
//   const sizePreview = document.getElementById('sizePreview');
//   if (sizeSlider) {
//     const handler = (e) => {
//       currentBrushSize = parseInt(e.target.value);
//       if (sizePreview) {
//         sizePreview.style.width = currentBrushSize + 'px';
//         sizePreview.style.height = currentBrushSize + 'px';
//       }
//       updateBrush();
//     };
//     sizeSlider.removeEventListener('input', handler);
//     sizeSlider.addEventListener('input', handler);
//   }
  
//   // Кнопка переключения инструмента
//   const switchBtn = document.getElementById('switchToolBtn');
//   if (switchBtn) {
//     const handler = () => {
//       currentTool = currentTool === 'pen' ? 'eraser' : 'pen';
//       switchBtn.innerHTML = currentTool === 'pen' ? '🖌️ Кисть' : '🧽 Ластик';
//       if (fabricCanvas) {
//         fabricCanvas.isDrawingMode = true;
//         // Пересоздаём кисть
//         fabricCanvas.freeDrawingBrush = new fabric.PencilBrush(fabricCanvas);
//         fabricCanvas.freeDrawingBrush.color = currentTool === 'eraser' ? 'black' : currentColor;
//         fabricCanvas.freeDrawingBrush.width = currentBrushSize;
//         fabricCanvas.renderAll();
//       }
//       updateBrush();
//     };
//     switchBtn.removeEventListener('click', handler);
//     switchBtn.addEventListener('click', handler);
//   }
  
//   // Цвет кисти
//   const colorPickerBtn = document.getElementById('colorPickerBtn');
//   const HEADER_COLORS = ["#252525","#1e293b","#0f766e","#9575CD","#6d28d9","#81C784","#FFF176","#FF8A65","#EF5350","#004D40","#FFFFFF","#000000"];
//   let colorIndex = HEADER_COLORS.indexOf(currentColor);
//   if (colorIndex === -1) colorIndex = 0;
//   if (colorPickerBtn) {
//     colorPickerBtn.style.backgroundColor = currentColor;
//     const handler = () => {
//       colorIndex = (colorIndex + 1) % HEADER_COLORS.length;
//       currentColor = HEADER_COLORS[colorIndex];
//       colorPickerBtn.style.backgroundColor = currentColor;
//       if (currentTool === 'pen') updateBrush();
//     };
//     colorPickerBtn.removeEventListener('click', handler);
//     colorPickerBtn.addEventListener('click', handler);
//   }
  
//   // Закрытие
//   const closeBtn = document.getElementById('closeDrawingModal');
//   if (closeBtn) {
//     const handler = () => {
//       document.getElementById('drawingModal').style.display = 'none';
//     };
//     closeBtn.removeEventListener('click', handler);
//     closeBtn.addEventListener('click', handler);
//   }
  
//   // Сохранение
//   const saveBtn = document.getElementById('saveDrawingBtn');
//   if (saveBtn) {
//     const handler = () => {
//       if (activeDrawingBlock && fabricCanvas) {
//         const vectorData = JSON.stringify(fabricCanvas.toJSON());
//         activeDrawingBlock.vectorData = vectorData;
//         scheduleBlocksSave();
//         document.getElementById('drawingModal').style.display = 'none';
//         // Обновить предпросмотр
//         const wrapper = document.querySelector(`.page-block[data-block-id="${activeDrawingBlock.id}"]`);
//         if (wrapper) updateDrawingPreview(activeDrawingBlock, wrapper);
//       }
//     };
//     saveBtn.removeEventListener('click', handler);
//     saveBtn.addEventListener('click', handler);
//   }
// }




////////////////////////////////////////////////
//         JS: СОЗДАНИЕ И УДАЛЕНИЕ СТРАНИЦ
////////////////////////////////////////////////
    async function createNewPage(parentId = null) {
      try {
        const res = await fetch("/api/pages/new", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parent_id: parentId })
        });
        const data = await res.json();
        if (data.page && data.page.id) {
          window.location.href = "/page/" + data.page.id;
        }
      } catch (e) {
        console.error("Failed to create page", e);
      }
    }

    document.getElementById("btn-new-page")?.addEventListener("click", () => {
      createNewPage(null);
    });

    document.getElementById("add-page-bottom")?.addEventListener("click", () => {
      createNewPage(null);
    });

    document.querySelectorAll(".nav-plus").forEach(el => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const parentId = el.getAttribute("data-parent-id");
        createNewPage(parentId);
      });
    });

    const pageId = document.body.getAttribute("data-page-id");
    const titleEl = document.getElementById("page-title");
    let titleSaveTimer = null;

////////////////////////////////////////////////
//         JS: РЕДАКТИРОВАНИЕ ЗАГОЛОВКА
////////////////////////////////////////////////
    function scheduleTitleSave() {
      if (!pageId) return;
      if (titleSaveTimer) clearTimeout(titleSaveTimer);
      titleSaveTimer = setTimeout(savePageState, 400);
    }

    if (titleEl) {
      titleEl.addEventListener("input", () => {
        const newTitle = (titleEl.innerText || "").trim() || "Untitled";

        updateSidebarTitle(pageId, newTitle);
        updatePageLinkBlocks(pageId, newTitle);

        scheduleTitleSave();
      });

      titleEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          titleEl.blur();
        }
      });

      titleEl.addEventListener("blur", () => {
        scheduleBlocksSave();
      });
    }

    document.querySelectorAll(".nav-delete").forEach(el => {
  el.addEventListener("click", async (e) => {
    e.stopPropagation();
    const deleteId = el.getAttribute("data-page-id");
    const currentPageId = document.body.getAttribute("data-page-id");
    if (!deleteId) return;

    const ok = await customConfirm("Удалить страницу и все вложенные?");
    if (!ok) return;

    try {
      const res = await fetch("/api/page/" + deleteId, { method: "DELETE" });
      const data = await res.json();
      if (res.ok && data.status === "ok") {
        if (deleteId === currentPageId) {
          // Функция для получения списка страниц с повторными попытками
          const getPagesListWithRetry = async (retries = 5, delay = 200) => {
            for (let i = 0; i < retries; i++) {
              try {
                const pagesRes = await fetch("/api/pages");
                const pagesData = await pagesRes.json();
                if (pagesData.pages && pagesData.pages.length > 0) {
                  return pagesData.pages;
                }
              } catch (e) {
                console.warn("Retry fetch pages", i, e);
              }
              await new Promise(r => setTimeout(r, delay));
            }
            return [];
          };

          const pagesList = await getPagesListWithRetry();
          if (pagesList.length > 0 && pagesList[0].id) {
            window.location.href = "/page/" + pagesList[0].id;
          } else {
            window.location.href = "/";
          }
        } else {
          window.location.reload();
        }
      } else {
        alert("Не удалось удалить страницу: " + (data.error || "unknown error"));
      }
    } catch (err) {
      console.error("Failed to delete page", err);
      alert("Ошибка при удалении страницы");
    }
  });
});



////////////////////////////////////////////////
//         JS: ЦВЕТНАЯ ШАПКА СТРАНИЦЫ
////////////////////////////////////////////////
const headerBar = document.getElementById("page-header-color-bar");
const headerColorBtn = document.getElementById("page-header-color-button");

const HEADER_COLORS = [
  "#252525",
  "#1e293b",
  "#0f766e",
  "#9575CD",
  "#6d28d9",
  "#81C784",
  "#FFF176",
  "#FF8A65",
  "#EF5350",
  "#004D40"
];

let currentHeaderColor = headerBar?.style.background || "#252525";

function applyHeaderColor(color) {
  if (!headerBar) return;
  currentHeaderColor = color;
  headerBar.style.background = color;
}

if (headerColorBtn && headerBar) {
  // берём стартовый цвет из инлайна (то, что пришло из page.cover_color)
  currentHeaderColor = headerBar.style.background || "#252525";

  headerColorBtn.addEventListener("click", () => {
    // просто крутимся по массиву, не полагаясь на совпадение строк
    let idx = HEADER_COLORS.findIndex(c => c.toLowerCase() === currentHeaderColor.toLowerCase());
    if (idx === -1) idx = 0;
    const nextIndex = (idx + 1) % HEADER_COLORS.length;
    applyHeaderColor(HEADER_COLORS[nextIndex]);
    scheduleBlocksSave();
  });
}






////////////////////////////////////////////////
//         JS: ПИКЕР ЭМОДЗИ ДЛЯ СТРАНИЦ
////////////////////////////////////////////////
    const EMOJIS = ["📄", "📘", "📕", "📗", "⭐", "🔥", "🧠", "💼", "⚡️", "🥇", "🥈", "🥉", "🎬", "🎮", "🎰", "🎼", "🏢", "🏦", "💡", "📁", "📖", "🔐", "🖤", "💜", "🤍", "🧡", "❤️", "🌐", "🏃🏻‍➡️", "✔️", "✖️", "📆", "💵", "🏠", "👓", "🤖", "💻", "⚙️", "🎯", "🎲", "🗽", "🗼", "🏯", "🎡", "🎢", "🗾", "🎉", "📧", "🧷", "💯", "🎄"];

    function createEmojiPicker(targetEl, pageIdForIcon) {
      const existing = document.getElementById("emoji-picker");
      if (existing) existing.remove();

      const picker = document.createElement("div");
      picker.id = "emoji-picker";
      picker.style.position = "fixed";
      picker.style.zIndex = "9999";
      picker.style.background = "#181818";
      picker.style.border = "1px solid #303030";
      picker.style.borderRadius = "6px";
      picker.style.padding = "4px";
      picker.style.display = "flex";
      picker.style.flexWrap = "wrap";
      picker.style.gap = "4px";
      picker.style.fontSize = "18px";

      const rect = targetEl.getBoundingClientRect();
      picker.style.left = rect.left + "px";
      picker.style.top = (rect.bottom + 4) + "px";

      EMOJIS.forEach(e => {
        const btn = document.createElement("button");
        btn.textContent = e;
        btn.style.background = "transparent";
        btn.style.border = "none";
        btn.style.cursor = "pointer";
        btn.style.padding = "2px";
        btn.addEventListener("click", async () => {
          try {
            await fetch("/api/page/" + pageIdForIcon, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ icon: e })
            });
            const span = targetEl.querySelector(".nav-page-emoji");
            if (span) {
              span.textContent = e;
            } else {
              targetEl.innerHTML = '<span class="nav-page-emoji">' + e + '</span>';
            }
            // обновляем иконку в заголовке, если это текущая страница
const currentPageId = document.body.getAttribute("data-page-id");
if (currentPageId === pageIdForIcon) {
  const titleIcon = document.getElementById("page-title-icon");
  if (titleIcon) {
    const tSpan = titleIcon.querySelector(".page-title-emoji");
    if (tSpan) {
      tSpan.textContent = e;
    }
  }
}
          } catch (err) {
            console.error("Failed to save icon", err);
          } finally {
            picker.remove();
          }
        });
        picker.appendChild(btn);
      });

      document.body.appendChild(picker);

      const onClickOutside = (ev) => {
        if (!picker.contains(ev.target) && ev.target !== targetEl) {
          picker.remove();
          document.removeEventListener("click", onClickOutside);
        }
      };
      setTimeout(() => {
        document.addEventListener("click", onClickOutside);
      }, 0);
    }

    document.querySelectorAll(".nav-page-icon").forEach(el => {
  el.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const parentItem = el.closest(".nav-item");
    const pid = parentItem?.getAttribute("data-page-id");
    if (!pid) return;
    createEmojiPicker(el, pid);
  });
});

////////////////////////////////////////////////
//         JS: БЛОКИ СТРАНИЦЫ
////////////////////////////////////////////////
    const blocksContainer = document.getElementById("blocks-container");
    let blocks = [];
    let openBlockMenu = null;

////////////////////////////////////////////////
//         JS: СОЗДАНИЕ ОДНОГО БЛОКА
////////////////////////////////////////////////
function createBlockElement(block, blocksArray, containerEl) {
  const wrapper = document.createElement("div");
  wrapper.className = "page-block";
  wrapper.dataset.blockId = block.id;

  // Левая кнопка (плюс)
  const leftControls = document.createElement("div");
  leftControls.className = "page-block-left";

  const plus = document.createElement("button");
  plus.className = "block-plus";
  plus.innerHTML = `
  <svg aria-hidden="true" role="graphics-symbol" viewBox="0 0 16 16" class="plusSmall"
       style="width:16px;height:16px;display:block;fill:currentColor;flex-shrink:0;">
    <path d="M8 2.74a.66.66 0 0 1 .66.66v3.94h3.94a.66.66 0 0 1 0 1.32H8.66v3.94a.66.66 0 1 1-1.32 0V8.66H3.4a.66.66 0 0 1 0-1.32h3.94V3.4A.66.66 0 0 1 8 2.74"></path>
  </svg>
`;
  leftControls.appendChild(plus);

  // Правая кнопка (корзина)
  const rightControls = document.createElement("div");
  rightControls.className = "page-block-right";

  const del = document.createElement("button");
  del.className = "block-delete";
  del.innerHTML = `
  <svg aria-hidden="true" role="graphics-symbol"
       viewBox="0 0 20 20"
       class="trash"
       style="width:20px;height:20px;display:block;fill:currentColor;flex-shrink:0;">
    <path d="M8.806 8.505a.55.55 0 0 0-1.1 0v5.979a.55.55 0 1 0 1.1 0zm3.488 0a.55.55 0 0 0-1.1 0v5.979a.55.55 0 1 0 1.1 0z"></path>
    <path d="M6.386 3.925v1.464H3.523a.625.625 0 1 0 0 1.25h.897l.393 8.646A2.425 2.425 0 0 0 7.236 17.6h5.528a2.425 2.425 0 0 0 2.422-2.315l.393-8.646h.898a.625.625 0 1 0 0-1.25h-2.863V3.925c0-.842-.683-1.525-1.525-1.525H7.91c-.842 0-1.524.683-1.524 1.525M7.91 3.65h4.18c.15 0 .274.123.274.275v1.464H7.636V3.925c0-.152.123-.275.274-.275m-.9 2.99h7.318l-.39 8.588a1.175 1.175 0 0 1-1.174 1.122H7.236a1.175 1.175 0 0 1-1.174-1.122l-.39-8.589z"></path>
  </svg>
`;
  rightControls.appendChild(del);

  // Контент
  const body = document.createElement("div");
  body.className = "page-block-body";

  const content = document.createElement("div");
  content.className = "page-block-text";
  body.appendChild(content);

  // Меню плюсика
  const menu = document.createElement("div");
  menu.className = "block-menu";
  menu.innerHTML = `
    <button data-type="text">Text</button>
    <button data-type="heading">Heading</button>
    <button data-type="todo">To‑do</button>
    <button data-type="page">Link to page</button>
    <button data-type="divider">Divider</button>
    <button data-type="columns">Columns</button>
    <button data-type="drawing">Drawing</button>
  `;

  applyBlockTypeStyles(wrapper, content, block, blocksArray);

  plus.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleBlockMenu(menu);
  });

  menu.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const type = btn.dataset.type;

    const index = blocksArray.findIndex(b => b.id === block.id);
    if (index === -1) return;

    // Обработка для columns (преобразование текущего блока)
    if (type === "columns") {
        const originalBlock = { ...block };
        const columnsBlock = {
            id: block.id,
            type: "columns",
            columns: [
                { width: 0.5, blocks: [originalBlock] },
                { width: 0.5, blocks: [{ id: crypto.randomUUID(), type: "text", text: "" }] }
            ]
        };
        blocksArray[index] = columnsBlock;
        const parent = wrapper.parentElement;
        parent.innerHTML = "";
        blocksArray.forEach(b => createBlockElement(b, blocksArray, parent));
        closeOpenMenu(menu);
        scheduleBlocksSave();
        return;
    }

    // Обработка для drawing (создание нового блока после текущего)
    if (type === "drawing") {
        const newBlock = {
            id: crypto.randomUUID(),
            type: "drawing",
            vectorData: null,
            tool: "pen",
            color: "#FFFFFF",
            brushSize: 5
        };
        blocksArray.splice(index + 1, 0, newBlock);
        const parent = wrapper.parentElement;
        parent.innerHTML = "";
        blocksArray.forEach(b => createBlockElement(b, blocksArray, parent));
        closeOpenMenu(menu);
        scheduleBlocksSave();
        return;
    }

    // Обработка для page (создание блока-ссылки)
    if (type === "page") {
        const newBlock = {
            id: crypto.randomUUID(),
            type: "page",
            text: "Select page…"
        };
        blocksArray.splice(index + 1, 0, newBlock);
        const parent = wrapper.parentElement;
        parent.innerHTML = "";
        blocksArray.forEach(b => createBlockElement(b, blocksArray, parent));
        closeOpenMenu(menu);
        scheduleBlocksSave();
        return;
    }

    // Общий случай для остальных типов (text, heading, todo, divider)
    const newBlock = {
        id: crypto.randomUUID(),
        type: type,
        text: ""
    };
    if (type === "todo") {
        newBlock.checked = false;
    }
    blocksArray.splice(index + 1, 0, newBlock);
    const parent = wrapper.parentElement;
    parent.innerHTML = "";
    blocksArray.forEach(b => createBlockElement(b, blocksArray, parent));
    closeOpenMenu(menu);
    scheduleBlocksSave();
});

  del.addEventListener("click", (e) => {
    e.stopPropagation();

    const index = blocksArray.findIndex(b => b.id === block.id);
    if (index === -1) return;

if (block._fabricCanvas) {
    if (block._resizeObserver) {
  block._resizeObserver.disconnect();
  delete block._resizeObserver;
}
  block._fabricCanvas.dispose();
}

    blocksArray.splice(index, 1);

    if (!blocksArray.length) {
      blocksArray.push({
        id: crypto.randomUUID(),
        type: "text",
        text: ""
      });
    }

    const parent = wrapper.parentElement;
    parent.innerHTML = "";
    blocksArray.forEach(b => createBlockElement(b, blocksArray, parent));

    scheduleBlocksSave();
  });

  wrapper.appendChild(leftControls);
  wrapper.appendChild(body);
  wrapper.appendChild(rightControls);
  wrapper.appendChild(menu);
  containerEl.appendChild(wrapper);
}




function renderBlocks() {
  if (!blocksContainer) return;
  blocksContainer.innerHTML = "";

  if (!blocks.length) {
    blocks.push({ id: crypto.randomUUID(), type: "text", text: "" });
  }

  blocks.forEach((block) => {
    createBlockElement(block, blocks, blocksContainer);
  });
}

let currentResize = null;

function attachColumnResizers(wrapper, block) {
  const wrapperEl = wrapper.querySelector('.columns-wrapper');
  if (!wrapperEl) return;
  
  const resizers = wrapperEl.querySelectorAll('.columns-resizer');
  resizers.forEach((resizer, idx) => {
    resizer.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const columns = block.columns;
      if (!columns?.[idx + 1]) return;
      
      const rect = wrapperEl.getBoundingClientRect();
      const startX = e.clientX;
      const startLeft = columns[idx].width;
      const startRight = columns[idx + 1].width;
      
      function move(e) {
        const delta = (e.clientX - startX) / rect.width;
        let newLeft = Math.max(0.1, Math.min(0.9, startLeft + delta));
        let newRight = Math.max(0.1, Math.min(0.9, startRight - delta));
        
        columns[idx].width = newLeft;
        columns[idx + 1].width = newRight;
        
        colEls[idx].style.flex = `${newLeft} 1 140px`;
        colEls[idx + 1].style.flex = `${newRight} 1 140px`;
      }
      
      const colEls = wrapperEl.querySelectorAll('.columns-column');
      document.onmousemove = move;
      document.onmouseup = () => {
        document.onmousemove = null;
        document.onmouseup = null;
        resizer.classList.remove('active');
        scheduleBlocksSave();
      };
      
      resizer.classList.add('active');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    };
  });
}










    function toggleBlockMenu(menu) {
      if (openBlockMenu && openBlockMenu !== menu) {
        openBlockMenu.style.display = "none";
      }
      const isOpen = menu.style.display === "flex";
      menu.style.display = isOpen ? "none" : "flex";
      if (!isOpen) {
        menu.style.display = "flex";
        openBlockMenu = menu;
      } else {
        openBlockMenu = null;
      }
    }

    function closeOpenMenu(menu) {
      if (menu) {
        menu.style.display = "none";
      }
      if (openBlockMenu === menu) {
        openBlockMenu = null;
      }
    }

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".block-menu") && !e.target.closest(".block-plus")) {
        if (openBlockMenu) {
          openBlockMenu.style.display = "none";
          openBlockMenu = null;
        }
      }
    });

    
////////////////////////////////////////////////
//         JS: MARKDOWN ДЛЯ TEXT-БЛОКОВ
////////////////////////////////////////////////

function escapeHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Очень простой markdown: заголовки, жирный, курсив, код, ссылки, списки
function renderMarkdownToHtml(md) {
  const escaped = escapeHtml(md || "");
  const lines = escaped.split(/\r?\n/);

  const htmlLines = [];
  let inUl = false;

  function closeUl() {
    if (inUl) {
      htmlLines.push("</ul>");
      inUl = false;
    }
  }

  for (let rawLine of lines) {
    let line = rawLine;

    // Пустая строка
    if (!line.trim()) {
      closeUl();
      htmlLines.push("<br>");
      continue;
    }

    // Список "- "
    if (/^\s*-\s+/.test(line)) {
      const item = line.replace(/^\s*-\s+/, "");
      if (!inUl) {
        htmlLines.push("<ul>");
        inUl = true;
      }
      line = "<li>" + item + "</li>";
      htmlLines.push(line);
      continue;
    } else {
      closeUl();
    }

    // Заголовки #, ##, ###
    if (/^\s*###\s+/.test(line)) {
      line = "<h3>" + line.replace(/^\s*###\s+/, "") + "</h3>";
    } else if (/^\s*##\s+/.test(line)) {
      line = "<h2>" + line.replace(/^\s*##\s+/, "") + "</h2>";
    } else if (/^\s*#\s+/.test(line)) {
      line = "<h1>" + line.replace(/^\s*#\s+/, "") + "</h1>";
    } else {
      // inline: **bold**, _italic_, `code`, [text](url)
      let l = line;

      // code
      l = l.replace(/`([^`]+)`/g, "<code>$1</code>");

      // bold
      l = l.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

      // italic
      l = l.replace(/_([^_]+)_/g, "<em>$1</em>");

      // links [text](url)
      l = l.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

      line = "<p>" + l + "</p>";
    }

    htmlLines.push(line);
  }

  closeUl();
  return htmlLines.join("\n");
}

////////////////////////////////////////////////
//         JS: ПРИМЕНЕНИЕ ТИПА БЛОКА
////////////////////////////////////////////////
function applyBlockTypeStyles(wrapper, content, block, blocksArray) {
  blocksArray = blocksArray || blocks;
  wrapper.classList.remove("heading", "todo", "page-link", "divider", "columns");
  content.innerHTML = "";

  if (block.type === "heading") {
    wrapper.classList.add("heading");
    const span = document.createElement("span");
    span.textContent = block.text || "";
    span.contentEditable = "true";
    span.addEventListener("input", () => {
      block.text = span.innerText;
      scheduleBlocksSave();
    });
    span.addEventListener("keydown", (e) => handleBlockKeydown(e, block, blocksArray));
    content.appendChild(span);

  } else if (block.type === "todo") {
    wrapper.classList.add("todo");
    if (typeof block.checked !== "boolean") {
      block.checked = false;
    }

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !!block.checked;

    const span = document.createElement("span");
    span.textContent = block.text || "";
    span.contentEditable = "true";

    content.appendChild(checkbox);
    content.appendChild(span);

    checkbox.addEventListener("change", () => {
      block.checked = checkbox.checked;
      scheduleBlocksSave();
    });

    span.addEventListener("input", () => {
      block.text = span.innerText;
      scheduleBlocksSave();
    });
    span.addEventListener("keydown", (e) => handleBlockKeydown(e, block, blocksArray));

  } else if (block.type === 'drawing') {
  wrapper.classList.add('drawing');

  const drawingContainer = document.createElement('div');
  drawingContainer.className = 'drawing-container';
  drawingContainer.style.display = 'flex';
  drawingContainer.style.flexDirection = 'column';
  drawingContainer.style.gap = '8px';

  const canvasWrapper = document.createElement('div');
  canvasWrapper.style.width = '100%';

  const canvasEl = document.createElement('canvas');
  canvasEl.id = `drawing-canvas-${block.id}`;
  canvasEl.style.display = 'block';
  canvasEl.style.background = 'black';
  canvasEl.style.borderRadius = '4px';
  canvasEl.style.border = '1px solid #2b2b2b';
  canvasEl.style.cursor = 'crosshair';
  canvasEl.style.width = '100%';
  canvasEl.style.height = 'auto';

  const FIXED_WIDTH = 1150;
  const FIXED_HEIGHT = 400;
  canvasEl.width = FIXED_WIDTH;
  canvasEl.height = FIXED_HEIGHT;

  canvasWrapper.appendChild(canvasEl);
  drawingContainer.appendChild(canvasWrapper);

  // Тулбар
  const toolbar = document.createElement('div');
  toolbar.className = 'drawing-toolbar';
  toolbar.style.display = 'none';
  toolbar.style.flexDirection = 'column';
  toolbar.style.gap = '8px';
  toolbar.style.padding = '8px';
  toolbar.style.background = '#181818';
  toolbar.style.borderRadius = '8px';
  toolbar.style.width = '100%';
  toolbar.style.boxSizing = 'border-box';
  toolbar.innerHTML = `
    <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <label style="color: #e5e5e5; font-size: 12px;">Размер:</label>
        <input type="range" min="1" max="30" value="${block.brushSize || 5}" class="drawing-brush-size" style="width: 120px;">
        <div class="drawing-size-preview" style="width: 20px; height: 20px; background: white; border-radius: 50%;"></div>
      </div>
      <button class="drawing-tool-switch" style="background: #2c2c2c; border: none; color: #e5e5e5; padding: 4px 8px; border-radius: 6px; cursor: pointer;">${block.tool === 'eraser' ? '🧽 Ластик' : '🖌️ Кисть'}</button>
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <div style="color: #e5e5e5; font-size: 12px;">Цвет:</div>
        <div class="drawing-color-preview" style="width: 32px; height: 32px; background: ${block.color || '#FFFFFF'}; border-radius: 50%; cursor: pointer; border: 2px solid #2b2b2b;"></div>
      </div>
      <button class="drawing-save" style="background: #3b82f6; border: none; color: white; padding: 4px 8px; border-radius: 6px; cursor: pointer;">Готово</button>
      <button class="drawing-cancel" style="background: #2c2c2c; border: none; color: #e5e5e5; padding: 4px 8px; border-radius: 6px; cursor: pointer;">Отмена</button>
    </div>
  `;
  drawingContainer.appendChild(toolbar);
  content.appendChild(drawingContainer);

  // ----- Растровое рисование -----
  let drawing = false;
  let lastX = 0, lastY = 0;
  const ctx = canvasEl.getContext('2d');

  function initContext() {
    ctx.strokeStyle = block.color;
    ctx.fillStyle = block.color;
    ctx.lineWidth = block.brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }
  initContext();

  // Загрузка сохранённого изображения (если есть)
  function loadSavedImage() {
    if (block.vectorData && block.vectorData.startsWith('data:image')) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
        ctx.drawImage(img, 0, 0, canvasEl.width, canvasEl.height);
      };
      img.src = block.vectorData;
    } else {
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);
    }
  }
  loadSavedImage();

  function startDraw(e) {
    drawing = true;
    const rect = canvasEl.getBoundingClientRect();
    const scaleX = canvasEl.width / rect.width;
    const scaleY = canvasEl.height / rect.height;
    lastX = (e.clientX - rect.left) * scaleX;
    lastY = (e.clientY - rect.top) * scaleY;
    lastX = Math.min(Math.max(0, lastX), canvasEl.width);
    lastY = Math.min(Math.max(0, lastY), canvasEl.height);

    if (block.tool === 'eraser') {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(lastX + 0.1, lastY + 0.1);
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(lastX, lastY);
      ctx.stroke();
    }
  }

  function drawMove(e) {
    if (!drawing) return;
    const rect = canvasEl.getBoundingClientRect();
    const scaleX = canvasEl.width / rect.width;
    const scaleY = canvasEl.height / rect.height;
    let currentX = (e.clientX - rect.left) * scaleX;
    let currentY = (e.clientY - rect.top) * scaleY;
    currentX = Math.min(Math.max(0, currentX), canvasEl.width);
    currentY = Math.min(Math.max(0, currentY), canvasEl.height);

    if (block.tool === 'eraser') {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(currentX, currentY);
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(currentX, currentY);
      ctx.stroke();
    }

    lastX = currentX;
    lastY = currentY;
  }

  function endDraw() {
    drawing = false;
    block.vectorData = canvasEl.toDataURL();
    scheduleBlocksSave();
  }

  canvasEl.addEventListener('mousedown', startDraw);
  canvasEl.addEventListener('mousemove', drawMove);
  canvasEl.addEventListener('mouseup', endDraw);
  canvasEl.addEventListener('mouseleave', endDraw);

  // ----- Тулбар (обновление параметров) -----
  const sizeSlider = toolbar.querySelector('.drawing-brush-size');
  const sizePreview = toolbar.querySelector('.drawing-size-preview');
  const toolSwitch = toolbar.querySelector('.drawing-tool-switch');
  const colorPreview = toolbar.querySelector('.drawing-color-preview');
  const saveBtn = toolbar.querySelector('.drawing-save');
  const cancelBtn = toolbar.querySelector('.drawing-cancel');

  let colorIndex = DRAWING_COLORS.indexOf(block.color || '#FFFFFF');
  if (colorIndex === -1) colorIndex = 0;

  sizeSlider.addEventListener('input', (e) => {
    block.brushSize = parseInt(e.target.value);
    sizePreview.style.width = block.brushSize + 'px';
    sizePreview.style.height = block.brushSize + 'px';
    ctx.lineWidth = block.brushSize;
  });

  toolSwitch.addEventListener('click', () => {
    block.tool = block.tool === 'pen' ? 'eraser' : 'pen';
    toolSwitch.innerHTML = block.tool === 'pen' ? '🖌️ Кисть' : '🧽 Ластик';
    if (block.tool === 'pen') {
      ctx.strokeStyle = block.color;
    }
  });

  colorPreview.addEventListener('click', () => {
    colorIndex = (colorIndex + 1) % DRAWING_COLORS.length;
    block.color = DRAWING_COLORS[colorIndex];
    colorPreview.style.backgroundColor = block.color;
    if (block.tool === 'pen') {
      ctx.strokeStyle = block.color;
    }
  });

  saveBtn.addEventListener('click', () => {
    block.vectorData = canvasEl.toDataURL();
    scheduleBlocksSave();
    toolbar.style.display = 'none';
  });

  cancelBtn.addEventListener('click', () => {
    loadSavedImage(); // перезагружаем сохранённое или чистим
    toolbar.style.display = 'none';
  });

  sizePreview.style.width = block.brushSize + 'px';
  sizePreview.style.height = block.brushSize + 'px';
  sizeSlider.value = block.brushSize;
  colorPreview.style.backgroundColor = block.color || '#FFFFFF';

  canvasEl.addEventListener('click', () => {
    toolbar.style.display = 'flex';
  });

  // Очистка при удалении блока
  block._cleanupDrawing = () => {
    canvasEl.removeEventListener('mousedown', startDraw);
    canvasEl.removeEventListener('mousemove', drawMove);
    canvasEl.removeEventListener('mouseup', endDraw);
    canvasEl.removeEventListener('mouseleave', endDraw);
  };
} else if (block.type === "page") {
    wrapper.classList.add("page-link");

    const link = document.createElement("span");
    link.textContent = block.text || "Select page…";
    link.contentEditable = "false";
    link.classList.add("page-link-label");

    if (block.page_id) {
      link.dataset.pageLinkId = block.page_id;
      link.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.location.href = "/page/" + block.page_id;
      });
    } else {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openPagePickerForBlock(block, wrapper, content);
      });
    }

    content.appendChild(link);

  } else if (block.type === "divider") {
    wrapper.classList.add("divider");

    const line = document.createElement("div");
    line.className = "page-divider-line";
    content.appendChild(line);

  } else if (block.type === 'columns') {
  wrapper.classList.add('columns');
  const columnsWrapper = document.createElement('div');
  columnsWrapper.className = 'columns-wrapper';
  
  const columns = Array.isArray(block.columns) && block.columns.length ? 
    block.columns : [
      { width: 0.5, blocks: [{ id: crypto.randomUUID(), type: 'text', text: '' }] },
      { width: 0.5, blocks: [{ id: crypto.randomUUID(), type: 'text', text: '' }] }
    ];
  
  // ЧЕРЕДУЕМ: колонка1 -> ресайзер -> колонка2
  for (let i = 0; i < columns.length; i++) {
    // Колонка
    const col = columns[i];
    const colEl = document.createElement('div');
    colEl.className = 'columns-column';
    colEl.style.flex = `${col.width} 1 140px`;
    
    const inner = document.createElement('div');
    inner.className = 'columns-column-inner';
    
    col.blocks.forEach(innerBlock => 
      createBlockElement(innerBlock, col.blocks, inner)
    );
    
    colEl.appendChild(inner);
    columnsWrapper.appendChild(colEl);
    
    // Ресайзер ПОСЛЕ колонки (кроме последней)
    if (i < columns.length - 1) {
      const resizer = document.createElement('div');
      resizer.className = 'columns-resizer';
      resizer.dataset.columnIndex = i;
      columnsWrapper.appendChild(resizer);
    }
  }
  
  content.appendChild(columnsWrapper);
  
  // ВАЖНО: вызываем после создания DOM
  setTimeout(() => attachColumnResizers(wrapper, block), 0);
} else {
  // Чистый text-блок + markdown-просмотр
  content.innerHTML = "";

  const editable = document.createElement("div");
  editable.className = "page-block-text";
  editable.contentEditable = "true";

  const rendered = document.createElement("div");
  rendered.className = "page-block-text-rendered";

  const raw = block.text || "";
  editable.textContent = raw;

  block.html = renderMarkdownToHtml(raw);
  rendered.innerHTML = block.html;

  editable.addEventListener("input", () => {
    const txt = (editable.innerText || "").replace(/\r/g, "");
    block.text = txt;
    block.html = renderMarkdownToHtml(txt);
    rendered.innerHTML = block.html;
  });

  editable.addEventListener("keydown", (e) => {
    handleBlockKeydown(e, block, blocksArray);
  });

  editable.addEventListener("focus", () => {
    editable.style.display = "block";
    rendered.style.display = "none";
  });

  editable.addEventListener("blur", () => {
    const txt = (editable.innerText || "").replace(/\r/g, "");
    block.text = txt;
    block.html = renderMarkdownToHtml(txt);
    rendered.innerHTML = block.html;
    editable.style.display = "none";
    rendered.style.display = "block";
    scheduleBlocksSave();
  });

  // стартуем в режиме просмотра
  editable.style.display = "none";
  rendered.style.display = "block";

  content.appendChild(rendered);
  content.appendChild(editable);
}
}


////////////////////////////////////////////////
//         JS: KEYDOWN / ВСТАВКА / УДАЛЕНИЕ
////////////////////////////////////////////////
function handleBlockKeydown(e, block, blocksArray) {
  blocksArray = blocksArray || blocks;

  const wrapper = e.target.closest(".page-block");
  if (!wrapper) return;

  // считаем индекс относительно родителя, а не глобального blocksContainer
  const parent = wrapper.parentElement;
  if (!parent) return;

  const allWrappers = Array.from(parent.querySelectorAll(".page-block"));
  const index = allWrappers.indexOf(wrapper);
  if (index === -1) return;

  if (block.type === "todo" && e.key === "Enter" && e.shiftKey) {
    e.preventDefault();
    return;
  }

  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    insertBlockAfterInArray(blocksArray, index, parent);
  }

  if (e.key === "Backspace") {
    const text = (e.target.innerText || "").trim();
    if (!text && blocksArray.length > 1) {
      e.preventDefault();
      removeBlockFromArray(blocksArray, index, parent);
    }
  }
}

function insertBlockAfterInArray(arr, index, containerEl) {
  const newBlock = { id: crypto.randomUUID(), type: "text", text: "" };
  arr.splice(index + 1, 0, newBlock);

  containerEl.innerHTML = "";
  arr.forEach(b => createBlockElement(b, arr, containerEl));

  scheduleBlocksSave();
}

function removeBlockFromArray(arr, index, containerEl) {
  arr.splice(index, 1);
  if (!arr.length) {
    arr.push({ id: crypto.randomUUID(), type: "text", text: "" });
  }

  containerEl.innerHTML = "";
  arr.forEach(b => createBlockElement(b, arr, containerEl));

  scheduleBlocksSave();
}



    function insertBlockAfter(index) {
      const newBlock = { id: crypto.randomUUID(), type: "text", text: "" };
      blocks.splice(index + 1, 0, newBlock);
      renderBlocks();
      focusBlock(index + 1);
      scheduleBlocksSave();
    }

    function removeBlock(index) {
      blocks.splice(index, 1);
      renderBlocks();
      focusBlock(Math.max(0, index - 1));
      scheduleBlocksSave();
    }

    function focusBlock(index) {
      const wrappers = blocksContainer.querySelectorAll(".page-block");
      const wrapper = wrappers[index];
      if (!wrapper) return;
      const editable = wrapper.querySelector("[contenteditable='true']");
      if (!editable) return;

      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(editable);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      editable.focus();
    }

    let blocksSaveTimer = null;

    function scheduleBlocksSave() {
      if (!pageId) return;
      if (blocksSaveTimer) clearTimeout(blocksSaveTimer);
      blocksSaveTimer = setTimeout(savePageState, 500);
    }

////////////////////////////////////////////////
//         JS: ОБЩЕЕ СОХРАНЕНИЕ СТРАНИЦЫ
////////////////////////////////////////////////
    async function savePageState() {
  const title = (titleEl?.innerText || "").trim() || "Untitled";
  const coverColor = currentHeaderColor || "#252525";
  try {
    await fetch("/api/page/" + pageId, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title,
        blocks: blocks,
        cover_color: coverColor
      })
    });
    document.title = title;
  } catch (e) {
    console.error("Failed to save page state", e);
  }
}


    blocksContainer.addEventListener("click", (e) => {
      const wrapper = e.target.closest(".page-block");
      if (!wrapper) return;
      const editable = wrapper.querySelector("[contenteditable='true']");
      if (!editable) return;
      if (e.target.closest(".block-plus") || e.target.closest(".block-menu")) return;

      const rendered = wrapper.querySelector(".page-block-text-rendered");
  if (rendered && editable) {
    rendered.style.display = "none";
    editable.style.display = "block";
  }

      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(editable);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      editable.focus();
    });

////////////////////////////////////////////////
//         JS: ОБНОВЛЕНИЕ САЙДБАРА И ЛИНК-БЛОКОВ
////////////////////////////////////////////////
    function updateSidebarTitle(id, newTitle) {
  const item = document.querySelector(`#sidebar-pages .nav-item[data-page-id="${id}"]`);
  if (!item) return;

  const label = item.querySelector(".sidebar-page-title");
  if (label) {
    label.textContent = newTitle;
  }
}


    function updatePageLinkBlocks(pageIdForLink, newTitle) {
      const linkBlocks = document.querySelectorAll(`[data-page-link-id="${pageIdForLink}"]`);
      linkBlocks.forEach((el) => {
        el.textContent = newTitle;
      });
      // также обновляем в массиве blocks
      blocks.forEach(b => {
        if (b.type === "page" && b.page_id === pageIdForLink) {
          b.text = newTitle;
        }
      });
    }

////////////////////////////////////////////////
//         JS: ПИКЕР СТРАНИЦ ДЛЯ LINK-БЛОКОВ
////////////////////////////////////////////////
    let allPagesCache = [];

    async function ensurePagesLoaded() {
      if (allPagesCache.length) return;
      try {
        const res = await fetch("/api/pages");
        const data = await res.json();
        allPagesCache = Array.isArray(data.pages) ? data.pages : [];
      } catch (e) {
        console.error("Failed to load pages list", e);
        allPagesCache = [];
      }
    }

    function openPagePickerForBlock(block, wrapper, content) {
      ensurePagesLoaded().then(() => {
        const existing = document.getElementById("page-picker");
        if (existing) existing.remove();

        const picker = document.createElement("div");
        picker.id = "page-picker";
        picker.className = "page-picker";

        const header = document.createElement("div");
        header.className = "page-picker-header";
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Search pages...";
        header.appendChild(input);

        const list = document.createElement("div");
        list.className = "page-picker-list";

        function renderList(filter = "") {
          list.innerHTML = "";
          const q = filter.toLowerCase();
          allPagesCache
            .filter(p => p.id !== pageId)
            .filter(p => !q || p.title.toLowerCase().includes(q))
            .forEach(p => {
              const item = document.createElement("div");
              item.className = "page-picker-item";
              item.textContent = p.title || "Untitled";
              item.title = p.title || "Untitled";
              item.addEventListener("click", () => {
                block.page_id = p.id;
                block.text = p.title || "Untitled";
                applyBlockTypeStyles(wrapper, content, block, blocks);
                scheduleBlocksSave();
                picker.remove();
              });
              list.appendChild(item);
            });
        }

        renderList("");

        input.addEventListener("input", () => {
          renderList(input.value);
        });

        picker.appendChild(header);
        picker.appendChild(list);

        document.body.appendChild(picker);

        const rect = wrapper.getBoundingClientRect();
        picker.style.left = rect.left + "px";
        picker.style.top = (rect.bottom + 4) + "px";

        const onClickOutside = (ev) => {
          if (!picker.contains(ev.target)) {
            picker.remove();
            document.removeEventListener("click", onClickOutside);
          }
        };
        setTimeout(() => {
          document.addEventListener("click", onClickOutside);
        }, 0);

        input.focus();
      });
    }

////////////////////////////////////////////////
//         JS: ЗАГРУЗКА ДАННЫХ СТРАНИЦЫ
////////////////////////////////////////////////
    async function loadPageData() {
  if (!pageId || !blocksContainer) return;
  try {
    const res = await fetch("/api/page/" + pageId);
    const data = await res.json();
    blocks = Array.isArray(data.blocks) ? data.blocks : [];
    renderBlocks();
  } catch (e) {
    console.error("Failed to load page data", e);
    blocks = [];
    renderBlocks();
  }
}

    loadPageData();

    // Кастомный confirm
function customConfirm(message) {
  return new Promise((resolve) => {
    const modal = document.getElementById('customConfirm');
    const msgSpan = document.getElementById('confirmMessage');
    const okBtn = document.getElementById('confirmOk');
    const cancelBtn = document.getElementById('confirmCancel');

    msgSpan.textContent = message;
    modal.style.display = 'flex';

    const onOk = () => {
      modal.style.display = 'none';
      cleanup();
      resolve(true);
    };
    const onCancel = () => {
      modal.style.display = 'none';
      cleanup();
      resolve(false);
    };

    const cleanup = () => {
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
    };

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
  });
}

// Обработка кликов по шевронам для сворачивания/разворачивания дерева страниц
document.addEventListener('click', (e) => {
  const chevron = e.target.closest('.nav-chevron');
  if (!chevron) return;

  const parentItem = chevron.closest('.nav-item');
  if (!parentItem) return;

  const childrenList = parentItem.querySelector(':scope > .nav-item-children');
  if (!childrenList) return;

  e.preventDefault();
  e.stopPropagation();

  // Переключаем класс collapsed на списке детей
  childrenList.classList.toggle('collapsed');

  // Переключаем класс expanded на родительском элементе (для поворота шеврона)
  if (childrenList.classList.contains('collapsed')) {
    parentItem.classList.remove('expanded');
  } else {
    parentItem.classList.add('expanded');
  }
});

// При загрузке страницы инициализируем состояние:
// Если у узла есть дети, по умолчанию они раскрыты (expanded). Можно по желанию.
document.querySelectorAll('.nav-item').forEach(item => {
  const childrenList = item.querySelector(':scope > .nav-item-children');
  if (childrenList) {
    // Начальное состояние — раскрыто (без класса collapsed)
    childrenList.classList.remove('collapsed');
    item.classList.add('expanded');
  }
});

// Поиск
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
let searchDebounceTimer = null;

if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchDebounceTimer);
    const query = e.target.value.trim();
    if (!query) {
      searchResults.classList.remove('show');
      return;
    }
    searchDebounceTimer = setTimeout(() => performSearch(query), 300);
  });

  // Скрыть результаты при клике вне
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
      searchResults.classList.remove('show');
    }
  });
}

async function performSearch(query) {
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    if (!data.results || data.results.length === 0) {
      searchResults.innerHTML = '<div class="search-result-item">Ничего не найдено</div>';
      searchResults.classList.add('show');
      return;
    }
    searchResults.innerHTML = '';
    data.results.forEach(item => {
      const div = document.createElement('div');
      div.className = 'search-result-item';
      div.innerHTML = `
        <span class="search-result-title">${escapeHtml(item.title)}</span>
        <span class="search-result-score">релевантность: ${item.score}</span>
      `;
      div.addEventListener('click', () => {
        window.location.href = `/page/${item.id}`;
      });
      searchResults.appendChild(div);
    });
    searchResults.classList.add('show');
  } catch (err) {
    console.error('Search failed', err);
  }
}



// Простой экранирование HTML (если ещё нет)
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}


