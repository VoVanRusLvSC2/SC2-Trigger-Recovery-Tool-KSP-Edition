// Standard legacy DDS block textures contain numeric headers and pixel blocks,
// not Galaxy declarations or data-catalog function/variable reference fields.
// Reserved header words have no reference-field semantics in the standard DDS
// texture contract. Writer stamps remain unchanged, as do every pixel byte.
// Layout: https://github.com/microsoft/DirectXTex/blob/main/DirectXTex/DDS.h
export function inspectNonCodeTexturePayload(fileName,bytes){
 const name=fileName.replaceAll('\\','/');
 if(!/^Assets\/.+\.dds$/iu.test(name)||name.split('/').some(p=>p==='.'||p==='..')||bytes.length<128||bytes.toString('ascii',0,4)!=='DDS ')return;
 const u=i=>bytes.readUInt32LE(i),flags=u(8),width=u(16),height=u(12),mips=u(28)||1,format=bytes.toString('ascii',84,88),block={DXT1:8,DXT3:16,DXT5:16}[format];
 if(u(4)!==124||u(76)!==32||u(80)!==4||!block||(flags&0x1007)!==0x1007||(flags&0x800000)||u(24)>1||!width||!height||width>16384||height>16384||mips>Math.floor(Math.log2(Math.max(width,height)))+1||!(u(108)&0x1000)||u(112))return;
 for(const [start,end]of [[88,108]])for(let i=start;i<end;i+=4)if(u(i)!==0)return;
 let size=0,w=width,h=height;for(let i=0;i<mips;i++){size+=Math.ceil(w/4)*Math.ceil(h/4)*block;w=Math.max(1,w>>1);h=Math.max(1,h>>1);}
 if(!Number.isSafeInteger(size)||bytes.length!==128+size||(flags&0x80000)&&u(20)!==Math.ceil(width/4)*Math.ceil(height/4)*block)return;
 return {kind:'STANDARD_DDS_HEADER_RESERVED_WORDS_AND_COMPLETE_PIXEL_BLOCKS',format,width,height,mips,pixelBytes:size,headerBytes:128,noTrailingData:true,reservedHeaderWordsIgnored:true,sourceOrAssetChanged:false,
  scope:'Standard SC2 texture loading and supplied Galaxy/native name/storage observers; not arbitrary external custom binary loaders.'};
}