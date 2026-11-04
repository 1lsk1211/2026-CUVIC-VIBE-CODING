// UserPromptSubmit hook: 입력한 프롬프트를 docs/prompt-log.md에 자동 기록
// 주의: 이 hook의 stdout은 Claude 컨텍스트에 추가되므로 아무것도 출력하지 않는다.
const fs = require("fs");
const path = require("path");

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  try {
    const input = JSON.parse(raw);
    // IDE가 자동으로 붙이는 <ide_opened_file>, <ide_selection> 등은 사용자가 입력한 내용이 아니므로 제외
    const prompt = (input.prompt || "").replace(/<(ide_[a-z_]+)>[\s\S]*?<\/\1>/g, "").trim();
    if (!prompt) return;

    const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
    const logPath = path.join(projectDir, "docs", "prompt-log.md");
    fs.mkdirSync(path.dirname(logPath), { recursive: true });

    const time = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }); // YYYY-MM-DD HH:mm:ss
    const session = (input.session_id || "unknown").slice(0, 8);
    const quoted = prompt.split("\n").map((line) => `> ${line}`).join("\n");

    fs.appendFileSync(logPath, `\n### ${time} (session ${session})\n\n${quoted}\n`, "utf8");
  } catch {
    // 로깅 실패가 작업을 막으면 안 되므로 조용히 무시
  }
});
