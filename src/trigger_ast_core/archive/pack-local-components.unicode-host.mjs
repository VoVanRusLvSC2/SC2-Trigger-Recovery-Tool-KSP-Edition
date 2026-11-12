import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,copyFile,constants} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {packLocalComponents} from '../../map_local_dependencies_2026-10-04/pack_local_components.mjs';
const ascii=s=>/^[\x20-\x7e]+$/u.test(s),sha=b=>createHash('sha256').update(b).digest('hex');

// The legacy CLI decodes host argv using ANSI. Keep Unicode in Node's UTF-16
// filesystem calls; all CLI host paths use a fresh ASCII staging directory.
// Container and every payload are still checked by the existing strict packer.
export async function packLocalComponentsUnicodeHost(input){
 const source=path.resolve(input.source),destination=path.resolve(input.destination),job=path.resolve(input.job);
 assert.notEqual(source.toLowerCase(),destination.toLowerCase(),'DISTINCT_PACKAGE_OUTPUT_REQUIRED');
 assert.equal(path.basename(source),path.basename(destination),'Preserve document filename');
 assert(ascii(job),'ASCII_PACK_JOB_REQUIRED');
 assert(input.components.every(c=>ascii(c.path)),'LEGACY_UNICODE_MEMBER_WRITE_UNSUPPORTED');
 if(ascii(source)&&ascii(destination))return packLocalComponents(input);
 const ext=path.extname(source);assert(/^\.SC2(?:Map|Mod)$/iu.test(ext),'SC2_DOCUMENT_EXTENSION_REQUIRED');
 const originalSha256=sha(await readFile(source));
 try{await readFile(destination);assert.fail('Destination already exists');}catch(e){if(e.code!=='ENOENT')throw e;}
 await mkdir(job,{recursive:true});
 const shadow=path.join(job,'ascii-host'),from=path.join(shadow,'source','Package'+ext),to=path.join(shadow,'output','Package'+ext);
 await mkdir(path.dirname(from),{recursive:true});await mkdir(path.dirname(to),{recursive:true});
 await copyFile(source,from,constants.COPYFILE_EXCL);
 assert.equal(sha(await readFile(from)),originalSha256,'SHADOW_SOURCE_MISMATCH');
 const packed=await packLocalComponents({...input,source:from,destination:to,job:path.join(shadow,'pack')});
 assert(packed.passed&&!packed.originalChanged);
 assert.equal(sha(await readFile(source)),originalSha256,'SOURCE_CHANGED');
 await mkdir(path.dirname(destination),{recursive:true});await copyFile(to,destination,constants.COPYFILE_EXCL);
 assert.equal(sha(await readFile(destination)),packed.destinationSha256,'PUBLISHED_CONTAINER_MISMATCH');
 assert.equal(sha(await readFile(source)),originalSha256,'SOURCE_CHANGED');
 const report={...packed,source,sourceSha256:originalSha256,destination,unicodeHostAdapter:true,
  shadowVerification:{path:path.join(shadow,'pack','PACK_VERIFICATION.json'),sha256:sha(await readFile(path.join(shadow,'pack','PACK_VERIFICATION.json')))},
  filenamePreserved:true,sourceChanged:false,semanticsClaim:false,editorVerified:false};
 await writeFile(path.join(job,'PACK_VERIFICATION.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 return report;
}
