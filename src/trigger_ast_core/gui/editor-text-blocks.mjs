import {xmlTree} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/shared/trigger-document/lossless-xml.js';

const escapeText=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');

/** Read the editor's block indentation; legacy inline text stays unchanged. */
export function readEditorTextBlock(raw) {
  const lines=raw.replace(/\r\n?/gu,'\n').split('\n');
  const indent=lines.at(-1)+'    ',body=lines.slice(1,-1);
  if(lines.length<3||lines[0].trim()!==''||indent.trim()!==''||!body.every(line=>line.startsWith(indent)||line.trim()===''))return raw;
  return body.map(line=>line.startsWith(indent)?line.slice(indent.length):'').join('\n');
}

/** Editor text fields use a block with four extra spaces per content line. */
export function editorTextBlockLines(tag,value,indent='      ') {
  if(!/^[A-Za-z][A-Za-z0-9_]*$/u.test(tag)||typeof value!=='string'||!/^[ \t]*$/u.test(indent))
    throw new TypeError('EDITOR_TEXT_BLOCK_SHAPE_REQUIRED');
  const lines=value.replace(/\r\n?/gu,'\n').split('\n');
  return [`${indent}<${tag}>`,...lines.map(line=>`${indent}    ${escapeText(line)}`),`${indent}</${tag}>`];
}

/** Repair cached inline comments after lossless serialization without changing
 * their typed identity, placement, text, or any other XML field. Existing
 * editor-authored blocks remain byte-exact. The model supplies decoded text. */
export function normalizeSerializedInlineComments(xml,library) {
  if(!/<Comment>(?![\r\n])/u.test(xml))return xml;
  const comments=new Map();
  for(const element of Object.values(library.elements??{}))if(element.type==='Comment'&&element.comment!==undefined){
    if(comments.has(element.id))throw new TypeError('GUI_COMMENT_ID_AMBIGUOUS');
    comments.set(element.id,element.comment);
  }
  if(!comments.size)return xml;
  const root=xmlTree(xml),edits=[];
  const initialOwner=root.children.find(n=>n.tag==='Standard')?.attributes.Id??library.id;
  const visit=(node,owner,depth)=>{
    if(node.tag==='Library')owner=node.attributes.Id;
    if(node.tag==='Element'&&node.attributes.Type==='Comment'&&owner===library.id&&comments.has(node.attributes.Id)){
      const value=node.children.find(n=>n.tag==='Comment');
      if(value&&!value.children.length){
        const raw=xml.slice(value.openEnd,value.closeStart);
        if(!/^[\r\n]/u.test(raw)){
          const lineStart=xml.lastIndexOf('\n',value.start-1)+1,prefix=xml.slice(lineStart,value.start);
          const ownLine=/^[ \t]*$/u.test(prefix),indent=ownLine?prefix:'  '.repeat(depth+1);
          const block=editorTextBlockLines('Comment',comments.get(node.attributes.Id),indent).join('\n');
          edits.push({start:value.start,end:value.end,text:ownLine?block.slice(indent.length):'\n'+block+'\n'+'  '.repeat(depth)});
        }
      }
    }
    for(const child of node.children)visit(child,owner,depth+1);
  };
  visit(root,initialOwner,0);
  for(const edit of edits.sort((a,b)=>b.start-a.start))xml=xml.slice(0,edit.start)+edit.text+xml.slice(edit.end);
  return xml;
}
