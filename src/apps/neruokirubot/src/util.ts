// ミリ秒を x時間x分x秒にするやつ いらない単位は消える
import axios from "axios";

export const getTimeFromMills = (m: number) => {
  let byo: number = Math.floor(m / 1000) % 60;
  let hun: number = Math.floor(m / 60000) % 60;
  let ji: number = Math.floor(m / 3600000);
  let result = "";
  if (ji != 0) result += ji + "時間 ";
  if (hun != 0) result += hun + "分 ";
  if (byo != 0) result += byo + "秒";
  return result;
};

export const getHoursFromMills = (m: number) => {
  let ji: number = Math.round((m / 3600000) * 10) / 10;
  return ji;
}

