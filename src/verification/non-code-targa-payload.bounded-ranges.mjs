// Standard TGA header/raw/RLE layout, independently implemented from format
// facts documented in Microsoft's DirectXTexTGA.cpp. Image IDs and all trailing
// extension/developer/unknown bytes remain opaque reference-bearing material.
export function inspectNonCodeTargaPayload(fileName,bytes){
 const name=fileName.replaceAll('\\','/');
 if(!/\.tga$/iu.test(name)||name.split('/').some(p=>p==='.'||p==='..')||bytes.length<18)return;
 const type=bytes[2],depth=bytes[16],descriptor=bytes[17],width=bytes.readUInt16LE(12),height=bytes.readUInt16LE(14),idBytes=bytes[0];
 if(bytes[1]!==0||bytes.subarray(3,8).some(x=>x!==0)||!width||!height||width>16384||height>16384||descriptor&0xc0)return;
 const gray=type===3||type===11,rle=type===10||type===11;
 if(![2,3,10,11].includes(type)||!(gray?depth===8:[16,24,32].includes(depth))||
  !(gray?(descriptor&15)===0:depth===16?[0,1].includes(descriptor&15):depth===24?(descriptor&15)===0:[0,8].includes(descriptor&15)))return;
 const start=18+idBytes,pixelBytes=depth/8,pixels=width*height;let end=start;
 if(start>bytes.length)return;
 if(!rle){end+=pixels*pixelBytes;if(end>bytes.length)return;}
 else{let remaining=pixels;while(remaining){if(end>=bytes.length)return;const packet=bytes[end++],count=(packet&127)+1;if(count>remaining)return;end+=(packet&128?1:count)*pixelBytes;if(end>bytes.length)return;remaining-=count;}}
 const nonReferenceRanges=[{start:0,end:18},{start,end}],opaqueRanges=[];
 if(idBytes)opaqueRanges.push({start:18,end:start});if(end<bytes.length)opaqueRanges.push({start:end,end:bytes.length});
 return{kind:'TGA_BOUNDED_HEADER_AND_PIXEL_RANGES',imageType:type,depth,width,height,rle,idBytes,pixelDataStart:start,pixelDataEnd:end,
  nonReferenceRanges,opaqueRanges,sourceOrAssetChanged:false,
  scope:'Standard TGA image loading and supplied Galaxy/native observers; image IDs, all metadata/tails and unsupported formats remain scanned.'};
}
