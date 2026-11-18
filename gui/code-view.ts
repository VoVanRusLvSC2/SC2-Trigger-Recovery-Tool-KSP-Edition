/** Paint only visible lines. The textarea remains the real selectable document,
 * so large Galaxy files do not require a span or DOM node for every token. */
export function createCodeViews() {
  const views = new Map<string, (text: string) => void>();
  for (const id of ['markup', 'source']) {
    const editor = document.getElementById(id) as HTMLTextAreaElement;
    const gutter = document.getElementById(id + 'Lines')!;
    const surface = document.createElement('div');
    surface.className = 'code-surface';
    const painted = document.createElement('pre');
    painted.className = 'code-highlight';
    painted.setAttribute('aria-hidden', 'true');
    editor.replaceWith(surface);
    surface.append(painted, editor);
    let offsets = [0],
      text = '',
      queued = false;
    function render() {
      queued = false;
      const first = Math.max(0, Math.floor((editor.scrollTop - 9) / 19));
      const last = Math.min(offsets.length, first + Math.ceil(editor.clientHeight / 19) + 3);
      const value = text.slice(offsets[first] ?? 0, offsets[last] ?? text.length);
      const pattern =
        id === 'markup'
          ? /<!--[\s\S]*?(?:-->|$)|<\/?[\w:-]+|[\w:-]+(?==)|"[^"\n]*"|'[^'\n]*'/g
          : /\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)|"(?:\\.|[^"\\])*"|\b(?:void|bool|int|fixed|string|text|unit|trigger|return|if|else|while|for|break|continue|include|const|native|struct|true|false|null)\b|\b\d+(?:\.\d+)?\b/g;
      const fragment = document.createDocumentFragment();
      let previous = 0,
        match: RegExpExecArray | null;
      while ((match = pattern.exec(value))) {
        fragment.append(document.createTextNode(value.slice(previous, match.index)));
        const span = document.createElement('span'),
          token = match[0];
        span.className =
          token.startsWith('//') || token.startsWith('/*') || token.startsWith('<!--')
            ? 'syntax-comment'
            : /^["']/.test(token)
              ? 'syntax-string'
              : /^\d/.test(token)
                ? 'syntax-number'
                : 'syntax-keyword';
        span.textContent = token;
        fragment.append(span);
        previous = pattern.lastIndex;
      }
      fragment.append(document.createTextNode(value.slice(previous)));
      painted.replaceChildren(fragment);
      painted.style.top = 9 + first * 19 - editor.scrollTop + 'px';
      painted.style.left = 11 - editor.scrollLeft + 'px';
      gutter.scrollTop = editor.scrollTop;
    }
    function queue() {
      if (!queued) {
        queued = true;
        requestAnimationFrame(render);
      }
    }
    editor.addEventListener('scroll', queue);
    new ResizeObserver(queue).observe(surface);
    views.set(id, (value) => {
      text = value.replace(/\r\n|\r/g, '\n');
      offsets = [0];
      for (let at = text.indexOf('\n'); at >= 0; at = text.indexOf('\n', at + 1))
        offsets.push(at + 1);
      render();
      surface.classList.add('highlighted');
    });
  }
  return (target: string, text: string) => views.get(target)?.(text);
}
