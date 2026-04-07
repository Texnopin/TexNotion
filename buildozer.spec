[app]

title = My Personal Notion
package.name = texnotion
package.domain = com.texnopin

source.dir = .
source.include_exts = py, png, jpg, kv, atlas, html, css, js, json, md

version = 0.1
requirements = python3, flask, rank-bm25, cython

bootstrap = webview

# Android config
android.api = 30
android.minapi = 21
android.ndk = 25b
android.build_tools = 30.0.3

android.permissions = INTERNET

log_level = 2
