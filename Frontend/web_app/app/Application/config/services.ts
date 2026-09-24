export type ServiceId =
  | "whatsapp"
  | "instagram"
  | "facebook"
  | "twitter"
  | "linkedin"
  | "snapchat"
  | "tiktok"
  | "pinterest"
  | "reddit"
  | "youtube"
  | "telegram"
  | "discord"
  | "slack"
  | "twitch"
  | "medium"
  | "quora"
  | "vimeo"
  | "flickr"
  | "tumblr"
  | "wechat"
  | "line"
  | "kakaotalk"
  | "viber"
  | "signal"
  | "skype";

export type ServiceDefinition = {
  id: ServiceId;
  name: string;
  shortName: string;
  description: string;
};

export const services: ServiceDefinition[] = [
  { id: "whatsapp", name: "WhatsApp", shortName: "WA", description: "Manage WhatsApp accounts, automation and AI behavior." },
  { id: "instagram", name: "Instagram", shortName: "IG", description: "Instagram automation and account management." },
  { id: "facebook", name: "Facebook", shortName: "FB", description: "Facebook pages, messages and automation." },
  { id: "twitter", name: "Twitter", shortName: "X", description: "Twitter/X account and posting automation." },
  { id: "linkedin", name: "LinkedIn", shortName: "IN", description: "LinkedIn account and workflow automation." },
  { id: "snapchat", name: "Snapchat", shortName: "SC", description: "Snapchat automation and account tools." },
  { id: "tiktok", name: "TikTok", shortName: "TT", description: "TikTok content and account automation." },
  { id: "pinterest", name: "Pinterest", shortName: "PT", description: "Pinterest publishing and automation." },
  { id: "reddit", name: "Reddit", shortName: "RD", description: "Reddit account and community workflows." },
  { id: "youtube", name: "YouTube", shortName: "YT", description: "YouTube channel and content workflows." },
  { id: "telegram", name: "Telegram", shortName: "TG", description: "Telegram bots, accounts and messaging." },
  { id: "discord", name: "Discord", shortName: "DC", description: "Discord servers, bots and automation." },
  { id: "slack", name: "Slack", shortName: "SK", description: "Slack workspace automation and messaging." },
  { id: "twitch", name: "Twitch", shortName: "TW", description: "Twitch channel and streaming workflows." },
  { id: "medium", name: "Medium", shortName: "MD", description: "Medium publishing and content workflows." },
  { id: "quora", name: "Quora", shortName: "QR", description: "Quora account and content workflows." },
  { id: "vimeo", name: "Vimeo", shortName: "VM", description: "Vimeo video and publishing workflows." },
  { id: "flickr", name: "Flickr", shortName: "FL", description: "Flickr photo and account workflows." },
  { id: "tumblr", name: "Tumblr", shortName: "TB", description: "Tumblr posting and account workflows." },
  { id: "wechat", name: "WeChat", shortName: "WC", description: "WeChat account and messaging workflows." },
  { id: "line", name: "LINE", shortName: "LN", description: "LINE messaging and automation." },
  { id: "kakaotalk", name: "KakaoTalk", shortName: "KT", description: "KakaoTalk account and messaging workflows." },
  { id: "viber", name: "Viber", shortName: "VB", description: "Viber messaging and automation." },
  { id: "signal", name: "Signal", shortName: "SG", description: "Signal messaging and automation." },
  { id: "skype", name: "Skype", shortName: "SP", description: "Skype messaging and automation." },
];
