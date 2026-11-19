# mock-exam — 蘇昊數理．會考模擬考 前端

純靜態網站（GitHub Pages），資料都放在 Supabase（後端 repo：`mock-exam-api`）。

## 設定
1. 先照 `mock-exam-api/README.md` 建好 Supabase 專案並開啟 Google 登入。
2. 打開 `js/config.js`，填入 Supabase 的 `Project URL` 和 `anon public` key。
3. 推上 GitHub，**Settings → Pages** 選 main 分支根目錄。
4. 網址（`https://<帳號>.github.io/mock-exam/`）要加進 Supabase 的 Site URL／Redirect URLs。

## 頁面
| 檔案 | 用途 |
|---|---|
| `index.html` | 考試總覽 |
| `exam.html?id=` | 考場：報名、准考證、題本、答案卡、成績單、詳解、排行榜 |
| `history.html` | 我的紀錄與成長曲線 |
| `report.html?id=` | 全體試題分析（通過率、鑑別度、選項分析、等級分布） |
| `group.html` | 團體負責人看自己學生的成績 |
| `admin.html` | 管理後台 |

## 前端保護
禁止右鍵、選取文字、複製、拖曳，以及 F12、Ctrl+U、Ctrl+S、Ctrl+P、Ctrl+Shift+I 等快捷鍵（准考證和成績單請用頁面上的列印按鈕）。前端保護只能擋一般使用者；真正的資料保護在後端：正解、詳解、成績、統計都要等伺服器時間到才會回傳。

## 防止亂報名
- 每個 Google 帳號（email）每場只能申請一次准考證，流水號不會重複使用；刪除帳號後用同一個 Gmail 重新登入也不能再申請。
- 管理員刪除報名時，可以選擇是否允許該帳號重新申請。
- 每場可以設定名額上限、最低作答題數、同一選項比例上限，不符合的作答自動判定為無效，不列入統計、PR、排行榜。
- 管理員可以手動把作答標記無效（附原因），或把帳號停權。
