import axios from "axios";

export const giveAAPoint = async (id: string, point: number) => {
  await generateMoneyById(id, point);
};

export async function sendMoneyById(fromId: number | string, toId: number | string, amount: number, memo: string = ""): Promise<boolean> {
  const sendBody = { fromId: fromId.toString(), toId: toId.toString(), amount, memo };
  // console.log(sendBody)
  const { data } = await axios.post("https://bank.ahoaho.jp/", sendBody);
  if (!data.success) throw new Error(data.message);
  return true;
}

export async function generateMoneyById(toId: number | string, amount: number): Promise<boolean> {
  const result = await sendMoneyById("885834421771567125", toId, amount);
  return result;
}
