/** Physical identity for the SDK's mounted folder-of-mods source.
 * packageFolderStorage maps Mods/.../Name.SC2Mod to Name.SC2Mod inside
 * its configured root; resolveLocalPath must apply the same mapping.
 * Otherwise VFS reads succeed but the same-session identity stamp fails.
 */
import {Sc2DesktopContentSources} from "../sdk/private-switch/modules/game/battlenet/content-sources/local-content-sources.js";
export function mountedModInnerPath(sourceId,file){
 if(!/^local:mods:\d+$/u.test(sourceId))return file;
 const parts=file.replaceAll('\\','/').split('/');
 if(!['mods','maps','campaigns'].includes(parts[0]?.toLowerCase()))return file;
 const at=parts.findIndex(p=>/\.sc2(?:mod|map|campaign)$/iu.test(p));
 if(at<1||parts.some(p=>!p||p==='.'||p==='..'))throw Error('Invalid mounted local mod identity path');
 return parts.slice(at).join('/');
}
export class LocalDependencySources extends Sc2DesktopContentSources{
 resolveLocalPath(sourceId,file){return super.resolveLocalPath(sourceId,mountedModInnerPath(sourceId,file));}
}
