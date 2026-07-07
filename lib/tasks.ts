import type { CareTask } from "@/lib/types";

export const careTasks: CareTask[] = [
  {
    id: "medicine",
    title: "薬を渡した",
    points: 5,
    description: "今日の支援の一歩です。",
  },
  {
    id: "meal",
    title: "食事を用意した",
    points: 5,
    description: "体を支えることにも意味があります。",
  },
  {
    id: "diaper",
    title: "おむつ交換をした",
    points: 10,
    description: "小さなケアも大切です。",
  },
  {
    id: "hospital",
    title: "病院・通院に付き添った",
    points: 20,
    description: "安心につながる時間です。",
  },
  {
    id: "talk",
    title: "声をかけた",
    points: 5,
    description: "そっと寄り添ったことが届きます。",
  },
  {
    id: "smile",
    title: "一緒に笑った",
    points: 15,
    description: "穏やかな時間をつくりました。",
  },
  {
    id: "rehab",
    title: "リハビリを応援した",
    points: 15,
    description: "今日の支えです。",
  },
  {
    id: "rest",
    title: "自分も休憩した",
    points: 10,
    description: "自分をいたわることも介護です。",
  },
  {
    id: "phone",
    title: "電話やメッセージで話した",
    points: 5,
    description: "離れていても、声はちゃんと届いています。",
  },
  {
    id: "arrange",
    title: "手続き・調整をした",
    points: 10,
    description: "暮らしを整えることも、大切な介護です。",
  },
];
