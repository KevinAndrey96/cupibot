export const APP_NAME = "CupiBot";

const HEART_WIDTH = 21;

const HEART_LINES = [
  "      ***   ***      ",
  "    *************    ",
  "  *****************  ",
  "  *****************  ",
  "   ***************   ",
  "    *************    ",
  "     ***********     ",
  "      *********      ",
  "       *******       ",
  "        *****        ",
  "         ***         ",
  "          *          ",
];

export const CUPIBOT_BANNER = [
  ...HEART_LINES,
  "",
  APP_NAME.padStart(Math.floor((HEART_WIDTH + APP_NAME.length) / 2)).padEnd(HEART_WIDTH),
].join("\n");

export function printCupiBotBanner(): void {
  console.log(`\n${CUPIBOT_BANNER}\n`);
}
