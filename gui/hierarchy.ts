/** TriggerData is a graph of scoped references, not a nested XML document.
 * Resolve only on expansion: shared definitions are not copied into a huge DOM. */
export interface HierarchyNode {
  label: string;
  children: () => HierarchyNode[];
}
const leaf = (label: string): HierarchyNode => ({ label, children: () => [] });
const attr = (node: Element, name: string) => node.getAttribute(name)?.trim() ?? '';
const key = (library: string, type: string, id: string) => JSON.stringify([library, type, id]);
const direct = (node: Element, tag: string) => [...node.children].find((n) => n.tagName === tag);
const excluded = new Set(['FunctionDef', 'ParameterDef', 'Preset', 'SubFunctionType', 'ValueType']);

export function buildHierarchy(xml: Document): HierarchyNode {
  if (xml.querySelector('parsererror')) throw Error('Invalid XML; inspect the markup panel.');
  const definitions = new Map<string, Element>();
  for (const node of xml.querySelectorAll('Element[Type][Id]')) {
    const scope = node.parentElement?.closest('Library')?.getAttribute('Id')?.trim() ?? '';
    const id = key(scope, attr(node, 'Type'), attr(node, 'Id'));
    if (!definitions.has(id)) definitions.set(id, node);
  }
  function reference(node: Element, scope: string, ancestors: ReadonlySet<string>): HierarchyNode {
    const type = attr(node, 'Type'),
      id = attr(node, 'Id'),
      library = attr(node, 'Library');
    const targetScope = library || scope;
    const targetKey = key(targetScope, type, id);
    return {
      label: `${node.tagName}${type ? ' -> ' + type : ''}${id ? ' : ' + id : ''}${library ? ' [' + library + ']' : ''}`,
      children: () => {
        if (!type || !id) return [];
        if (ancestors.has(targetKey))
          return [leaf(`[Loop] ${type}:${id}${targetScope ? ' [' + targetScope + ']' : ''}`)];
        const target = definitions.get(targetKey);
        if (!target)
          return [
            leaf(`[Missing reference] ${type}:${id}${targetScope ? ' [' + targetScope + ']' : ''}`),
          ];
        const nested = new Set(ancestors).add(targetKey);
        return [...target.children].map((child) => {
          if (attr(child, 'Type') && attr(child, 'Id') && !excluded.has(child.tagName))
            return reference(child, targetScope, nested);
          let text = (child.textContent ?? '').replace(/[\r\n]/g, ' ').trim();
          if (text.length > 140) text = text.slice(0, 137) + '...';
          const attributes = ['Value', 'Identifier', 'Comment'].includes(child.tagName)
            ? ''
            : [...child.attributes].map((a) => `${a.name}=${a.value}`).join(', ');
          return leaf(
            child.tagName + (attributes ? ` (${attributes})` : '') + (text ? ' = ' + text : ''),
          );
        });
      },
    };
  }
  function items(container: Element, scope: string): HierarchyNode[] {
    const root = direct(container, 'Root');
    return root
      ? [...root.children]
          .filter((n) => n.tagName === 'Item')
          .map((n) => reference(n, scope, new Set()))
      : [leaf('No <Root> node found')];
  }
  return {
    label: 'TriggerData',
    children: () => [
      ...items(xml.documentElement, ''),
      ...[...xml.querySelectorAll('Library')].map((library) => ({
        label: 'Library' + (attr(library, 'Id') ? ': ' + attr(library, 'Id') : ''),
        children: () => items(library, attr(library, 'Id')),
      })),
    ],
  };
}

export function renderHierarchy(container: HTMLElement, model: HierarchyNode, count: HTMLElement) {
  container.replaceChildren();
  container.setAttribute('role', 'tree');
  let displayed = 0;
  function branch(node: HierarchyNode, level: number): HTMLElement {
    const item = document.createElement('li');
    item.setAttribute('role', 'treeitem');
    item.setAttribute('aria-level', String(level));
    const row = document.createElement('button');
    row.className = 'tree-row';
    row.textContent = node.label;
    row.title = node.label;
    row.tabIndex = -1;
    item.append(row);
    const children = node.children();
    if (children.length) item.setAttribute('aria-expanded', 'false');
    let group: HTMLUListElement | undefined;
    const expand = () => {
      if (!children.length) {
        item.removeAttribute('aria-expanded');
        return;
      }
      if (!group) {
        group = document.createElement('ul');
        group.setAttribute('role', 'group');
        for (const child of children) group.append(branch(child, level + 1));
        item.append(group);
      }
      group.hidden = item.getAttribute('aria-expanded') === 'true';
      item.setAttribute('aria-expanded', String(!group.hidden));
    };
    row.onclick = () => {
      select(row);
      expand();
    };
    row.onkeydown = (event) => {
      const rows = [...container.querySelectorAll<HTMLButtonElement>('.tree-row')].filter(
        (r) => !r.closest('[hidden]'),
      );
      const index = rows.indexOf(row);
      let next: HTMLButtonElement | undefined;
      if (event.key === 'ArrowDown') next = rows[index + 1];
      else if (event.key === 'ArrowUp') next = rows[index - 1];
      else if (event.key === 'Home') next = rows[0];
      else if (event.key === 'End') next = rows.at(-1);
      else if (event.key === 'ArrowRight') {
        if (item.getAttribute('aria-expanded') !== 'true') expand();
        else next = group?.querySelector<HTMLButtonElement>('.tree-row') ?? undefined;
      } else if (event.key === 'ArrowLeft') {
        if (item.getAttribute('aria-expanded') === 'true') expand();
        else
          next =
            item.parentElement
              ?.closest('li')
              ?.querySelector<HTMLButtonElement>(':scope > .tree-row') ?? undefined;
      } else return;
      event.preventDefault();
      if (next) {
        select(next);
        next.focus();
      }
    };
    displayed++;
    count.textContent = `Nodes: ${displayed.toLocaleString()} loaded`;
    if (level === 1) expand();
    return item;
  }
  function select(row: HTMLButtonElement) {
    for (const current of container.querySelectorAll<HTMLButtonElement>('.tree-row')) {
      current.tabIndex = current === row ? 0 : -1;
      current.parentElement!.setAttribute('aria-selected', String(current === row));
    }
  }
  const root = document.createElement('ul');
  root.setAttribute('role', 'none');
  root.append(branch(model, 1));
  container.append(root);
  select(root.querySelector('button')!);
}
