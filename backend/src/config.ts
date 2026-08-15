import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Xatolik: ${name} environment o'zgaruvchisi berilmagan`);
    process.exit(1);
  }
  return value;
}

export const config = {
  botToken: required("BOT_TOKEN"),
  databaseUrl: required("DATABASE_URL"),
  adminLogin: required("ADMIN_LOGIN"),
  adminPassword: required("ADMIN_PASSWORD"),
  jwtSecret: required("JWT_SECRET"),
  /**
   * AI kalitlari. Ikkalasi ham bo'sh bo'lsa assistent o'chadi va bot eski
   * tugmali rejimda ishlayveradi. Ikkalasi berilsa Google ustun turadi.
   */
  googleApiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  /** Modelni majburan belgilash; bo'sh bo'lsa provayderning sukutdagi modeli */
  aiModel: process.env.AI_MODEL || "",
  devGroupId: process.env.DEV_GROUP_ID || "",
  backlogChatId: process.env.BACKLOG_CHAT_ID || "",
  port: Number(process.env.PORT) || 3000,
};
