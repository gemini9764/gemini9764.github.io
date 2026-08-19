---
icon: fas fa-pen-to-square
order: 5
title: 새 글 쓰기
---

<div class="np">
  <p class="np-lede">
    제목과 분류를 채우면 파일명과 front matter를 만들어 GitHub 편집기를 엽니다.
    본문은 그곳에서 이어서 쓰고 커밋하면 글이 올라갑니다.
  </p>

  <div class="np-grid">
    <div class="np-field np-span">
      <label for="np-title">제목</label>
      <input type="text" id="np-title" placeholder="예: Chirpy 블로그를 gem 기반으로 옮긴 기록" autocomplete="off">
    </div>

    <div class="np-field np-span">
      <label for="np-slug">슬러그</label>
      <input type="text" id="np-slug" placeholder="제목에서 자동으로 만들어집니다" autocomplete="off">
      <small>글 주소에 쓰입니다. 영문으로 바꾸면 링크가 깔끔해집니다.</small>
    </div>

    <div class="np-field">
      <label for="np-date">작성 시각</label>
      <input type="datetime-local" id="np-date">
    </div>

    <div class="np-field">
      <label for="np-categories">카테고리</label>
      <input type="text" id="np-categories" placeholder="Blog, Jekyll" autocomplete="off">
      <small>최대 2단계. 쉼표로 구분합니다.</small>
    </div>

    <div class="np-field np-span">
      <label for="np-tags">태그</label>
      <input type="text" id="np-tags" placeholder="chirpy, github-pages, ruby" autocomplete="off">
    </div>

    <div class="np-field np-span">
      <label for="np-description">요약</label>
      <input type="text" id="np-description" placeholder="목록과 검색 결과에 표시됩니다" autocomplete="off">
    </div>

    <div class="np-field">
      <label for="np-image">대표 이미지 경로</label>
      <input type="text" id="np-image" placeholder="/assets/img/posts/example.png" autocomplete="off">
    </div>

    <div class="np-field">
      <label for="np-alt">이미지 설명</label>
      <input type="text" id="np-alt" placeholder="스크린샷에 대한 설명" autocomplete="off">
    </div>
  </div>

  <fieldset class="np-toggles">
    <legend>옵션</legend>
    <label><input type="checkbox" id="np-pin"> 홈에 고정</label>
    <label><input type="checkbox" id="np-math"> 수식 사용</label>
    <label><input type="checkbox" id="np-mermaid"> 다이어그램 사용</label>
  </fieldset>

  <div class="np-preview">
    <div class="np-preview-head">
      <span class="np-dot" aria-hidden="true"></span>
      <code id="np-filename">_posts/</code>
    </div>
    <pre id="np-frontmatter"></pre>
  </div>

  <p class="np-error" id="np-error" role="status"></p>

  <div class="np-actions">
    <a href="#" id="np-open" class="np-btn np-btn-primary">GitHub에서 이어 쓰기</a>
    <button type="button" id="np-copy" class="np-btn">front matter 복사</button>
  </div>
</div>

<style>
.np {
  --np-gap: 1.25rem;
  max-width: 46rem;
}
.np-lede {
  color: var(--text-muted-color);
  margin-bottom: 1.75rem;
  line-height: 1.7;
}
.np-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--np-gap);
}
.np-span { grid-column: 1 / -1; }
.np-field { display: flex; flex-direction: column; }
.np-field label {
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--heading-color);
  margin-bottom: 0.4rem;
}
.np-field small {
  margin-top: 0.35rem;
  font-size: 0.75rem;
  color: var(--text-muted-color);
}
.np input[type="text"],
.np input[type="datetime-local"] {
  width: 100%;
  padding: 0.55rem 0.7rem;
  font-size: 0.92rem;
  color: var(--text-color);
  background: var(--main-bg);
  border: 1px solid var(--main-border-color);
  border-radius: 6px;
  transition: border-color 0.15s ease;
}
.np input:focus-visible {
  outline: none;
  border-color: var(--link-color);
  box-shadow: 0 0 0 3px rgb(from var(--link-color) r g b / 18%);
}
.np-toggles {
  display: flex;
  flex-wrap: wrap;
  gap: 1.25rem;
  margin: var(--np-gap) 0 1.75rem;
  padding: 0.9rem 1.1rem;
  border: 1px solid var(--main-border-color);
  border-radius: 6px;
}
.np-toggles legend {
  width: auto;
  padding: 0 0.4rem;
  margin: 0;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-muted-color);
}
.np-toggles label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.88rem;
  margin: 0;
  cursor: pointer;
}
.np-preview {
  border: 1px solid var(--main-border-color);
  border-radius: 6px;
  overflow: hidden;
}
.np-preview-head {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.5rem 0.85rem;
  border-bottom: 1px solid var(--main-border-color);
  background: var(--card-bg, var(--main-bg));
}
.np-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted-color);
  flex: none;
}
.np-preview-head code {
  font-size: 0.82rem;
  color: var(--text-muted-color);
  background: none;
  padding: 0;
  word-break: break-all;
}
.np-preview pre {
  margin: 0;
  padding: 0.9rem 1rem;
  font-size: 0.82rem;
  line-height: 1.65;
  background: none;
  border: 0;
  white-space: pre-wrap;
  word-break: break-word;
}
.np-error {
  min-height: 1.4rem;
  margin: 0.85rem 0 0;
  font-size: 0.85rem;
  color: #d9534f;
}
.np-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-top: 0.5rem;
}
.np-btn {
  display: inline-block;
  padding: 0.55rem 1.1rem;
  font-size: 0.9rem;
  font-weight: 500;
  border-radius: 6px;
  border: 1px solid var(--main-border-color);
  background: none;
  color: var(--text-color);
  cursor: pointer;
  transition: opacity 0.15s ease;
}
.np-btn:hover { opacity: 0.78; text-decoration: none; }
.np-btn-primary {
  background: var(--link-color);
  border-color: var(--link-color);
  color: #fff;
}
.np-btn-primary:hover { color: #fff; }
.np-btn[aria-disabled="true"] { opacity: 0.45; pointer-events: none; }
@media (max-width: 576px) {
  .np-grid { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) {
  .np *, .np { transition: none !important; }
}
</style>

<script>
(function () {
  /* ── 저장소 설정 ─────────────────────────────── */
  const OWNER  = 'gemini9764';
  const REPO   = 'gemini9764.github.io';
  const BRANCH = 'main';
  /* ───────────────────────────────────────────── */

  const $ = (id) => document.getElementById(id);
  const el = {
    title: $('np-title'), slug: $('np-slug'), date: $('np-date'),
    categories: $('np-categories'), tags: $('np-tags'),
    description: $('np-description'), image: $('np-image'), alt: $('np-alt'),
    pin: $('np-pin'), math: $('np-math'), mermaid: $('np-mermaid'),
    filename: $('np-filename'), frontmatter: $('np-frontmatter'),
    error: $('np-error'), open: $('np-open'), copy: $('np-copy')
  };

  let slugTouched = false;

  const pad = (n) => String(n).padStart(2, '0');

  function localNow() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }

  function slugify(text) {
    return text.toLowerCase().trim()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .replace(/[\s-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function offset(d) {
    const mins = -d.getTimezoneOffset();
    const sign = mins >= 0 ? '+' : '-';
    const abs = Math.abs(mins);
    return sign + pad(Math.floor(abs / 60)) + pad(abs % 60);
  }

  function splitList(raw) {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }

  function yamlString(s) {
    return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  }

  function build() {
    const title = el.title.value.trim();
    const slug = (el.slug.value.trim() || slugify(title));
    const stamp = el.date.value ? new Date(el.date.value) : new Date();
    const datePart = stamp.getFullYear() + '-' + pad(stamp.getMonth() + 1) + '-' + pad(stamp.getDate());
    const timePart = pad(stamp.getHours()) + ':' + pad(stamp.getMinutes()) + ':00';

    const lines = ['---'];
    lines.push('title: ' + yamlString(title || '제목 없음'));
    lines.push('date: ' + datePart + ' ' + timePart + ' ' + offset(stamp));

    const cats = splitList(el.categories.value);
    if (cats.length) lines.push('categories: [' + cats.join(', ') + ']');

    const tags = splitList(el.tags.value).map((t) => t.toLowerCase());
    if (tags.length) lines.push('tags: [' + tags.join(', ') + ']');

    const desc = el.description.value.trim();
    if (desc) lines.push('description: ' + yamlString(desc));

    if (el.pin.checked) lines.push('pin: true');
    if (el.math.checked) lines.push('math: true');
    if (el.mermaid.checked) lines.push('mermaid: true');

    const img = el.image.value.trim();
    if (img) {
      lines.push('image:');
      lines.push('  path: ' + img);
      const alt = el.alt.value.trim();
      if (alt) lines.push('  alt: ' + yamlString(alt));
    }

    lines.push('---', '', '');

    return {
      title: title,
      slug: slug,
      path: '_posts/' + datePart + '-' + (slug || 'untitled') + '.md',
      body: lines.join('\n')
    };
  }

  function render() {
    const post = build();
    el.filename.textContent = post.path;
    el.frontmatter.textContent = post.body.trimEnd();

    const url = 'https://github.com/' + OWNER + '/' + REPO + '/new/' + BRANCH +
      '?filename=' + encodeURIComponent(post.path) +
      '&value=' + encodeURIComponent(post.body);

    let problem = '';
    if (!post.title) problem = '제목을 입력하면 링크가 열립니다.';
    else if (!post.slug) problem = '제목에서 슬러그를 만들 수 없습니다. 직접 입력해 주세요.';
    else if (url.length > 8000) problem = '내용이 너무 길어 링크로 전달할 수 없습니다. 아래 복사 버튼을 사용하세요.';

    el.error.textContent = problem;
    el.open.href = problem ? '#' : url;
    el.open.setAttribute('aria-disabled', problem ? 'true' : 'false');
  }

  el.slug.addEventListener('input', function () { slugTouched = this.value.trim() !== ''; });
  el.title.addEventListener('input', function () {
    if (!slugTouched) el.slug.value = slugify(this.value);
  });

  Object.values(el).forEach(function (node) {
    if (node && (node.tagName === 'INPUT')) node.addEventListener('input', render);
  });

  el.copy.addEventListener('click', function () {
    const original = this.textContent;
    navigator.clipboard.writeText(build().body).then(() => {
      this.textContent = '복사했습니다';
      setTimeout(() => { this.textContent = original; }, 1600);
    }).catch(() => {
      el.error.textContent = '복사에 실패했습니다. 위 미리보기에서 직접 선택해 주세요.';
    });
  });

  el.date.value = localNow();
  render();
})();
</script>