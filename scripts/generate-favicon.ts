import sharp from "sharp";
import { writeFileSync } from "node:fs";

// One SVG source for the tab icon and its legacy ICO fallback.
const png = await sharp("app/icon.svg").resize(32, 32).png().toBuffer();
const ico = Buffer.alloc(22 + png.length);
ico.writeUInt16LE(1, 2); // ICO type
ico.writeUInt16LE(1, 4); // one image
ico[6] = 32;
ico[7] = 32;
ico.writeUInt16LE(1, 10);
ico.writeUInt16LE(32, 12);
ico.writeUInt32LE(png.length, 14);
ico.writeUInt32LE(22, 18);
png.copy(ico, 22);
writeFileSync("app/favicon.ico", ico);
