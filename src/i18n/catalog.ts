// Columns: English, Traditional Chinese, Simplified Chinese, Japanese, Korean.
// English source messages are stable lookup keys; configuration values are never keys.
const rows = `error.workingDirectory|尚未設定工作目錄或主程式路徑。請先到應用程式設定下載或選擇 NOALBS 主程式。|尚未设置工作目录或主程序路径。请先到应用设置下载或选择 NOALBS 主程序。|作業ディレクトリまたは実行ファイルのパスが未設定です。アプリ設定で NOALBS をダウンロードまたは選択してください。|작업 디렉터리 또는 실행 파일 경로가 설정되지 않았습니다. 앱 설정에서 NOALBS를 다운로드하거나 선택하세요.
error.binaryMissing|找不到 NOALBS 主程式。請先下載或指定主程式路徑。|找不到 NOALBS 主程序。请先下载或指定主程序路径。|NOALBS 実行ファイルが見つかりません。ダウンロードするかパスを指定してください。|NOALBS 실행 파일을 찾을 수 없습니다. 다운로드하거나 경로를 지정하세요.
error.notRunning|NOALBS 尚未啟動。|NOALBS 尚未启动。|NOALBS は起動していません。|NOALBS가 실행 중이 아닙니다.
error.alreadyRunning|NOALBS 已在執行中。|NOALBS 已在运行中。|NOALBS はすでに実行中です。|NOALBS가 이미 실행 중입니다.
error.backupMissing|找不到可還原的備份。|找不到可恢复的备份。|復元できるバックアップがありません。|복원할 백업을 찾을 수 없습니다.
error.noAsset|找不到適用於此作業系統或處理器架構的版本。|找不到适用于此操作系统或处理器架构的版本。|この OS または CPU に対応するリリースがありません。|이 운영체제 또는 CPU 아키텍처에 맞는 버전이 없습니다.
error.io|無法讀取或寫入檔案。請確認路徑、檔案權限及可用磁碟空間。|无法读取或写入文件。请检查路径、文件权限及可用磁盘空间。|ファイルを読み書きできません。パス、アクセス権、空き容量を確認してください。|파일을 읽거나 쓸 수 없습니다. 경로, 권한 및 디스크 공간을 확인하세요.
error.http|網路請求失敗。請確認網路連線後再試一次。|网络请求失败。请检查网络连接后重试。|ネットワーク要求に失敗しました。接続を確認して再試行してください。|네트워크 요청에 실패했습니다. 연결을 확인하고 다시 시도하세요.
error.json|JSON 設定格式或欄位內容不正確。請檢查設定後再試一次。|JSON 设置格式或字段内容不正确。请检查设置后重试。|JSON の形式または設定値が正しくありません。設定を確認してください。|JSON 형식 또는 설정 값이 올바르지 않습니다. 설정을 확인하세요.
error.archive|無法解壓縮下載檔案，請重新下載後再試一次。|无法解压下载文件，请重新下载后重试。|ダウンロードしたファイルを展開できません。再ダウンロードしてください。|다운로드한 파일을 압축 해제할 수 없습니다. 다시 다운로드하세요.
error.unknown|操作失敗，請展開詳細資訊查看原因。|操作失败，请展开详细信息查看原因。|操作に失敗しました。詳細情報を確認してください。|작업에 실패했습니다. 자세한 정보를 확인하세요.
Error details|錯誤詳細資訊（原文）|错误详细信息（原文）|エラー詳細（原文）|오류 상세 정보 (원문)
auto|自動下載|自动下载|自動ダウンロード|자동 다운로드
manual|手動選擇|手动选择|手動選択|직접 선택
Running|執行中|运行中|実行中|실행 중
Disabled|已停用|已禁用|無効|비활성화됨
Waiting for OBS|等待 OBS 連線|等待 OBS 连接|OBS 接続を待機中|OBS 연결 대기 중
Waiting for streaming|等待開始串流|等待开始串流|配信開始を待機中|스트리밍 시작 대기 중
Waiting for switchable scene|等待可切換的場景|等待可切换的场景|切り替え可能なシーンを待機中|전환 가능한 장면 대기 중
Offline timeout — stopping stream|離線逾時，正在停止串流|离线超时，正在停止串流|オフライン時間超過、配信を停止中|오프라인 시간 초과 — 스트리밍 중지 중
{hours}h {minutes}m {seconds}s|{hours} 小時 {minutes} 分 {seconds} 秒|{hours} 小时 {minutes} 分 {seconds} 秒|{hours}時間 {minutes}分 {seconds}秒|{hours}시간 {minutes}분 {seconds}초
{minutes}m {seconds}s|{minutes} 分 {seconds} 秒|{minutes} 分 {seconds} 秒|{minutes}分 {seconds}秒|{minutes}분 {seconds}초
Confirm|確認|确认|確認|확인
Cancel|取消|取消|キャンセル|취소
JSON editor|JSON 編輯器|JSON 编辑器|JSON エディター|JSON 편집기
Find|搜尋|查找|検索|찾기
Replace|取代|替换|置換|바꾸기
next|下一個|下一个|次へ|다음
previous|上一個|上一个|前へ|이전
all|全部|全部|すべて|전체
match case|區分大小寫|区分大小写|大文字と小文字を区別|대소문자 구분
regexp|正規表示式|正则表达式|正規表現|정규 표현식
by word|完整單字|完整单词|単語単位|단어 단위
replace|取代|替换|置換|바꾸기
replace all|全部取代|全部替换|すべて置換|모두 바꾸기
close|關閉|关闭|閉じる|닫기
Go to line|跳至指定行|跳转到指定行|指定行へ移動|줄로 이동
go|前往|前往|移動|이동
Fold line|摺疊此行|折叠此行|行を折りたたむ|줄 접기
Unfold line|展開此行|展开此行|行を展開|줄 펼치기
folded code|已摺疊的程式碼|已折叠的代码|折りたたまれたコード|접힌 코드
unfold|展開|展开|展開|펼치기
Folded lines|已摺疊行|已折叠行|折りたたんだ行|접힌 줄
Unfolded lines|已展開行|已展开行|展開した行|펼친 줄
to|至|至|から|부터
Completions|補全建議|补全建议|入力候補|자동 완성
Selection deleted|已刪除選取內容|已删除所选内容|選択範囲を削除しました|선택 영역 삭제됨
Control character|控制字元|控制字符|制御文字|제어 문자
Diagnostics|診斷訊息|诊断信息|診断|진단
No diagnostics|沒有診斷訊息|没有诊断信息|診断情報はありません|진단 정보 없음
current match|目前符合項目|当前匹配项|現在の一致|현재 일치 항목
on line|位於行|位于行|行|줄
replaced match on line $|已取代第 $ 行的符合項目|已替换第 $ 行的匹配项|$ 行目の一致を置換しました|$ 줄의 일치 항목을 바꿨습니다
replaced $ matches|已取代 $ 個符合項目|已替换 $ 个匹配项|$ 件を置換しました|$ 개의 일치 항목을 바꿨습니다
Dashboard|監控總覽|监控总览|ダッシュボード|대시보드
Settings|應用程式設定|应用设置|アプリ設定|앱 설정
Config|串流設定|串流设置|配信設定|스트리밍 설정
Logs|執行日誌|运行日志|ログ|로그
Connections & credentials|連線與憑證|连接与凭据|接続と認証情報|연결 및 인증 정보
Monitor your streaming connections and scene switching.|掌握串流連線與場景切換狀態。|掌握串流连接与场景切换状态。|配信の接続とシーン切り替えを確認します。|스트리밍 연결 및 장면 전환 상태를 확인합니다.
Configure switching rules, scenes, servers, and chat.|設定切換規則、場景、伺服器與聊天室。|设置切换规则、场景、服务器与聊天室。|切り替えルール、シーン、サーバー、チャットを設定します。|전환 규칙, 장면, 서버 및 채팅을 설정합니다.
Manage your bot credentials separately from stream configuration.|獨立管理機器人憑證，與串流設定分開儲存。|独立管理机器人凭据，与串流设置分开保存。|配信設定とは別にボットの認証情報を管理します。|스트리밍 설정과 별도로 봇 인증 정보를 관리합니다.
Inspect the original output from NOALBS.|查看 NOALBS 的原始執行輸出。|查看 NOALBS 的原始运行输出。|NOALBS の出力をそのまま確認します。|NOALBS의 원본 출력을 확인합니다.
Manage the application, appearance, and startup preferences.|管理程式、外觀與啟動偏好。|管理程序、外观与启动偏好。|アプリ、外観、起動時の動作を管理します。|앱, 화면 및 시작 환경설정을 관리합니다.
Interface language|介面語言|界面语言|表示言語|인터페이스 언어
Loading…|載入中…|加载中…|読み込み中…|불러오는 중…
noalbs binary|NOALBS 主程式|NOALBS 主程序|NOALBS 実行ファイル|NOALBS 실행 파일
Version:|版本：|版本：|バージョン：|버전:
no binary selected|尚未選擇主程式|尚未选择主程序|実行ファイル未選択|실행 파일 미선택
Downloading…|下載中…|下载中…|ダウンロード中…|다운로드 중…
Download latest|下載最新版|下载最新版|最新版をダウンロード|최신 버전 다운로드
Check for updates|檢查更新|检查更新|更新を確認|업데이트 확인
Choose binary…|選擇主程式…|选择主程序…|実行ファイルを選択…|실행 파일 선택…
Update available:|有可用更新：|有可用更新：|更新があります：|업데이트 가능:
Control|執行控制|运行控制|実行操作|실행 제어
Status:|狀態：|状态：|状態：|상태:
running|執行中|运行中|実行中|실행 중
stopped|已停止|已停止|停止中|중지됨
Start|啟動|启动|起動|시작
Stop|停止|停止|停止|중지
Restart|重新啟動|重新启动|再起動|다시 시작
Appearance|外觀|外观|外観|화면
Theme|主題|主题|テーマ|테마
Follow system|跟隨系統|跟随系统|システム設定|시스템 설정
Light|淺色|浅色|ライト|라이트
Dark|深色|深色|ダーク|다크
Updates|更新|更新|更新|업데이트
Check for noalbs updates on startup|啟動時檢查 NOALBS 更新|启动时检查 NOALBS 更新|起動時に NOALBS の更新を確認|시작 시 NOALBS 업데이트 확인
Startup|啟動|启动|起動|시작 설정
Start noalbs automatically on launch|開啟應用程式時自動啟動 NOALBS|打开应用时自动启动 NOALBS|アプリ起動時に NOALBS を自動起動|앱 실행 시 NOALBS 자동 시작
uptime|執行時間|运行时间|稼働時間|가동 시간
connected|已連線|已连接|接続済み|연결됨
connecting|連線中|连接中|接続中|연결 중
disconnected|未連線|未连接|未接続|연결 끊김
auth failed|驗證失敗|验证失败|認証失敗|인증 실패
not configured|尚未設定|尚未设置|未設定|설정되지 않음
Fix — get a token|取得權杖以修復|获取令牌以修复|トークンを取得して修復|토큰을 받아 복구
Scene|目前場景|当前场景|現在のシーン|현재 장면
Switcher|自動切換|自动切换|自動切り替え|자동 전환
Start noalbs from the Settings tab to see live status.|請到應用程式設定啟動 NOALBS，即可查看即時狀態。|请到应用设置启动 NOALBS，即可查看实时状态。|アプリ設定で NOALBS を起動すると状態を確認できます。|앱 설정에서 NOALBS를 시작하면 실시간 상태를 볼 수 있습니다.
Reload|重新載入|重新加载|再読み込み|새로고침
No|找不到|找不到|見つかりません：|없음:
found in the working directory.|於工作目錄中。|于工作目录中。|作業ディレクトリ内。|작업 디렉터리 내.
Set a working directory (or download/select the binary) and create a config — full template support comes later. For now, create a config.json next to the binary, then reload.|請先下載或選擇主程式，在主程式旁建立 config.json，然後重新載入。|请先下载或选择主程序，在主程序旁创建 config.json，然后重新加载。|実行ファイルを選択またはダウンロードし、同じ場所に config.json を作成して再読み込みしてください。|실행 파일을 선택하거나 다운로드한 후 같은 위치에 config.json을 만들고 새로고침하세요.
No backup available yet.|尚無可用備份。|暂无可用备份。|バックアップがありません。|사용 가능한 백업이 없습니다.
an unknown time|未知時間|未知时间|不明な日時|알 수 없는 시간
Restored. Restart noalbs to apply now?|已還原。立即重新啟動 NOALBS 套用？|已还原。立即重新启动 NOALBS 应用？|復元しました。NOALBS を再起動して適用しますか？|복원했습니다. NOALBS를 다시 시작하여 적용할까요?
Restored and restarted noalbs.|已還原並重新啟動 NOALBS。|已还原并重新启动 NOALBS。|復元し、NOALBS を再起動しました。|복원하고 NOALBS를 다시 시작했습니다.
Restored. Restart noalbs to apply.|已還原，重新啟動 NOALBS 後套用。|已还原，重新启动 NOALBS 后应用。|復元しました。適用には NOALBS を再起動してください。|복원했습니다. 적용하려면 NOALBS를 다시 시작하세요.
Restored from backup.|已從備份還原。|已从备份还原。|バックアップから復元しました。|백업에서 복원했습니다.
Config saved. Restart noalbs to apply the changes now?|設定已儲存。立即重新啟動 NOALBS 套用？|设置已保存。立即重新启动 NOALBS 应用？|設定を保存しました。NOALBS を再起動して適用しますか？|설정을 저장했습니다. NOALBS를 다시 시작하여 적용할까요?
Saved and restarted noalbs.|已儲存並重新啟動 NOALBS。|已保存并重新启动 NOALBS。|保存し、NOALBS を再起動しました。|저장하고 NOALBS를 다시 시작했습니다.
Saved. Restart noalbs to apply.|已儲存，重新啟動 NOALBS 後套用。|已保存，重新启动 NOALBS 后应用。|保存しました。適用には NOALBS を再起動してください。|저장했습니다. 적용하려면 NOALBS를 다시 시작하세요.
Saved.|已儲存。|已保存。|保存しました。|저장했습니다.
Form|表單|表单|フォーム|양식
Advanced (JSON)|進階（JSON）|高级（JSON）|詳細（JSON）|고급 (JSON)
Restore backup|還原備份|还原备份|バックアップを復元|백업 복원
Save|儲存|保存|保存|저장
filter…|搜尋日誌…|搜索日志…|ログを検索…|로그 검색…
autoscroll|自動捲動|自动滚动|自動スクロール|자동 스크롤
Clear|清除|清除|消去|지우기
A new noalbs version is available:|有新的 NOALBS 版本：|有新的 NOALBS 版本：|NOALBS の新しいバージョン：|새 NOALBS 버전:
Updating…|更新中…|更新中…|更新中…|업데이트 중…
Update now|立即更新|立即更新|今すぐ更新|지금 업데이트
Dismiss|關閉通知|关闭通知|閉じる|닫기
Chat|聊天室|聊天室|チャット|채팅
Chat is not configured.|尚未設定聊天室。|尚未设置聊天室。|チャットは未設定です。|채팅이 설정되지 않았습니다.
Enable chat|啟用聊天室|启用聊天室|チャットを有効化|채팅 활성화
Platform|平台|平台|プラットフォーム|플랫폼
Channel ID|頻道 ID|频道 ID|チャンネル ID|채널 ID
Chatroom ID|聊天室 ID|聊天室 ID|チャットルーム ID|채팅방 ID
Use IRL proxy|使用 IRL 代理|使用 IRL 代理|IRL プロキシを使用|IRL 프록시 사용
Username|使用者名稱|用户名|ユーザー名|사용자 이름
Language|聊天回覆語言|聊天回复语言|チャット応答言語|채팅 응답 언어
Prefix|指令前綴|命令前缀|コマンド接頭辞|명령어 접두사
Admins|管理員|管理员|管理者|관리자
Ignore users|忽略使用者|忽略用户|無視するユーザー|무시할 사용자
Enable public commands|啟用公開指令|启用公开命令|公開コマンドを有効化|공개 명령어 활성화
Enable mod commands|啟用版主指令|启用版主命令|モデレーターコマンドを有効化|관리자 명령어 활성화
Auto-stop on host/raid|託管／揪團時自動停止|托管／团播时自动停止|ホスト／レイド時に自動停止|호스트/레이드 시 자동 중지
Announce raid on auto-stop|自動停止時公告揪團|自动停止时公告团播|自動停止時にレイドを告知|자동 중지 시 레이드 알림
Command overrides|自訂指令設定|自定义命令设置|コマンドの個別設定|명령어 개별 설정
Permission|權限|权限|権限|권한
(default)|（預設）|（默认）|（既定）|(기본값)
remove|移除|移除|削除|삭제
User permissions|使用者權限|用户权限|ユーザー権限|사용자 권한
Aliases|別名|别名|別名|별칭
+ add command override…|＋ 新增指令設定…|＋ 新增命令设置…|＋ コマンド設定を追加…|＋ 명령어 설정 추가…
Bot credentials (.env)|機器人憑證（.env）|机器人凭据（.env）|ボット認証情報（.env）|봇 인증 정보 (.env)
.env saved. Restart noalbs to apply the changes now?|.env 已儲存。立即重新啟動 NOALBS 套用？|.env 已保存。立即重新启动 NOALBS 应用？|.env を保存しました。NOALBS を再起動しますか？|.env를 저장했습니다. NOALBS를 다시 시작할까요?
Saved .env|已儲存 .env|已保存 .env|.env を保存しました|.env 저장됨
Stored in|儲存於|保存于|保存先：|저장 위치:
next to config.json. Sensitive values are hidden by default and never logged.|，與 config.json 位於相同目錄。敏感資料預設隱藏且不會寫入日誌。|，与 config.json 位于相同目录。敏感数据默认隐藏且不会写入日志。|config.json と同じ場所にあります。機密情報は既定で非表示となり、ログには記録されません。|config.json과 같은 위치입니다. 민감한 값은 기본적으로 숨겨지며 로그에 기록되지 않습니다.
Twitch bot username|Twitch 機器人名稱|Twitch 机器人名称|Twitch ボット名|Twitch 봇 이름
Twitch bot OAuth|Twitch 機器人 OAuth|Twitch 机器人 OAuth|Twitch ボット OAuth|Twitch 봇 OAuth
hide|隱藏|隐藏|隠す|숨기기
show|顯示|显示|表示|표시
Get token|取得權杖|获取令牌|トークンを取得|토큰 받기
API port (enables the local WebSocket API)|API 連接埠（啟用本機 WebSocket API）|API 端口（启用本地 WebSocket API）|API ポート（ローカル WebSocket API を有効化）|API 포트 (로컬 WebSocket API 활성화)
Log dir (optional)|日誌目錄（選填）|日志目录（选填）|ログディレクトリ（任意）|로그 디렉터리 (선택)
Save .env|儲存憑證|保存凭据|認証情報を保存|인증 정보 저장
OBS connection|OBS 連線|OBS 连接|OBS 接続|OBS 연결
Host|主機|主机|ホスト|호스트
Port|連接埠|端口|ポート|포트
Password|密碼|密码|パスワード|비밀번호
Optional options|其他選項|其他选项|その他のオプション|기타 옵션
Twitch transcoding check|檢查 Twitch 轉碼|检查 Twitch 转码|Twitch トランスコード確認|Twitch 트랜스코딩 확인
Twitch transcoding retries|Twitch 轉碼重試次數|Twitch 转码重试次数|Twitch トランスコード再試行回数|Twitch 트랜스코딩 재시도 횟수
Twitch transcoding delay (seconds)|Twitch 轉碼延遲（秒）|Twitch 转码延迟（秒）|Twitch トランスコード待機（秒）|Twitch 트랜스코딩 대기 (초)
Offline timeout (seconds)|離線逾時（秒）|离线超时（秒）|オフラインタイムアウト（秒）|오프라인 시간 제한 (초)
Record while streaming|串流時同步錄影|串流时同步录像|配信中に録画|스트리밍 중 녹화
Switch to starting scene on stream start|開始串流時切換至開場場景|开始串流时切换至开场场景|配信開始時に開始シーンに切り替え|방송 시작 시 시작 장면으로 전환
Switch from starting scene to live scene|從開場場景切換至直播場景|从开场场景切换至直播场景|開始シーンから配信シーンに切り替え|시작 장면에서 방송 장면으로 전환
Optional scenes|其他場景|其他场景|追加シーン|추가 장면
Starting|開場|开场|開始|시작
Ending|結尾|结尾|終了|종료
Privacy|隱私|隐私|プライバシー|개인정보 보호
Refresh|重新整理|刷新|リフレッシュ|새로고침
Type|類型|类型|種類|유형
Name|名稱|名称|名前|이름
Priority|優先順序|优先顺序|優先度|우선순위
enabled|啟用|启用|有効|활성화
 (optional)|（選填）|（选填）|（任意）| (선택)
Override scenes|覆寫場景|覆盖场景|シーンを上書き|장면 재정의
Use auth|使用驗證|使用验证|認証を使用|인증 사용
Normal|正常|正常|通常|정상
Low|低位元率|低码率|低ビットレート|낮은 비트레이트
Offline|離線|离线|オフライン|오프라인
Depends on another server|相依於其他伺服器|依赖其他服务器|別のサーバーに依存|다른 서버에 의존
Depends on (name)|相依伺服器名稱|依赖服务器名称|依存先サーバー名|의존하는 서버 이름
Backup scenes|備援場景|备用场景|バックアップシーン|백업 장면
Stream servers (|串流伺服器（|串流服务器（|配信サーバー（|스트림 서버 (
No stream servers. Add one below.|尚無串流伺服器，請在下方新增。|暂无串流服务器，请在下方添加。|配信サーバーがありません。下から追加してください。|스트림 서버가 없습니다. 아래에서 추가하세요.
+ Add stream server|＋ 新增串流伺服器|＋ 添加串流服务器|＋ 配信サーバーを追加|＋ 스트림 서버 추가
Bitrate switcher enabled|啟用位元率切換|启用码率切换|ビットレート切り替えを有効化|비트레이트 전환 활성화
Only switch when streaming|僅於串流時切換|仅在串流时切换|配信中のみ切り替え|스트리밍 중에만 전환
Instantly switch on recover|恢復時立即切換|恢复时立即切换|復旧時に即座に切り替え|복구 시 즉시 전환
Auto switch notification|自動切換通知|自动切换通知|自動切り替え通知|자동 전환 알림
Retry attempts|重試次數|重试次数|再試行回数|재시도 횟수
Triggers (kbps / ms)|觸發條件（kbps / ms）|触发条件（kbps / ms）|トリガー（kbps / ms）|트리거 (kbps / ms)
RTT offline|RTT 離線門檻|RTT 离线阈值|RTT オフライン閾値|RTT 오프라인 임계값
Switching scenes|切換場景|切换场景|切り替えシーン|전환 장면
+ add|＋ 新增|＋ 添加|＋ 追加|＋ 추가
Stats URL|統計網址|统计网址|統計 URL|통계 URL
Application|應用程式|应用程序|アプリケーション|애플리케이션
Key|串流金鑰|串流密钥|ストリームキー|스트림 키
Listener ID (IP:Port)|接收端 ID（IP:Port）|接收端 ID（IP:Port）|リスナー ID（IP:Port）|리스너 ID (IP:Port)
Publisher / StreamID|發佈端／StreamID|发布端／StreamID|パブリッシャー／StreamID|게시자 / StreamID
Publisher|發佈端|发布端|パブリッシャー|게시자
API key|API 金鑰|API 密钥|API キー|API 키
Invalid JSON: {error}|JSON 格式錯誤：{error}|JSON 格式错误：{error}|無効な JSON：{error}|잘못된 JSON: {error}
Error: {error}|錯誤：{error}|错误：{error}|エラー：{error}|오류: {error}
Restore backup from {when}? This overwrites your current config.|還原 {when} 的備份？這將覆寫目前設定。|还原 {when} 的备份？这将覆盖当前设置。|{when} のバックアップを復元しますか？現在の設定が上書きされます。|{when}의 백업을 복원할까요? 현재 설정을 덮어씁니다.
Updated to {version}.|已更新至 {version}。|已更新至 {version}。|{version} に更新しました。|{version}(으)로 업데이트했습니다.
Update failed: {error}|更新失敗：{error}|更新失败：{error}|更新失敗：{error}|업데이트 실패: {error}
last switch: {type}|上次切換：{type}|上次切换：{type}|前回の切り替え：{type}|마지막 전환: {type}
user: {user}|使用者：{user}|用户：{user}|ユーザー：{user}|사용자: {user}
No log entries.|尚無日誌。|暂无日志。|ログはありません。|로그가 없습니다.
No matching log entries.|沒有符合的日誌。|没有匹配的日志。|一致するログはありません。|일치하는 로그가 없습니다.
Stream control|串流控制台|串流控制台|配信コントロール|스트림 제어
Stream servers ({count})|串流伺服器（{count}）|串流服务器（{count}）|配信サーバー（{count}）|스트림 서버 ({count})
No config.json found in the working directory.|工作目錄中找不到 config.json。|工作目录中找不到 config.json。|作業ディレクトリに config.json がありません。|작업 디렉터리에 config.json이 없습니다.
Stored in .env next to config.json. Sensitive values are hidden by default and never logged.|儲存於 config.json 旁的 .env。敏感資料預設隱藏且不會寫入日誌。|保存于 config.json 旁的 .env。敏感数据默认隐藏且不会写入日志。|config.json と同じ場所の .env に保存されます。機密情報は既定で非表示となり、ログには記録されません。|config.json 옆의 .env에 저장됩니다. 민감한 값은 기본적으로 숨겨지며 로그에 기록되지 않습니다.`;

export const locales = ["en", "zh-TW", "zh-CN", "ja", "ko"] as const;
export type Locale = typeof locales[number];
export const localeNames: Record<Locale, string> = {
  en: "English", "zh-TW": "繁體中文", "zh-CN": "简体中文", ja: "日本語", ko: "한국어",
};
export const messages = Object.fromEntries(locales.map((locale, index) => [locale,
  Object.fromEntries(rows.split("\n").map(row => {
    const columns = row.split("|");
    if (columns.length !== locales.length) throw new Error(`Invalid translation: ${columns[0]}`);
    return [columns[0], columns[index]];
  })),
])) as Record<Locale, Record<string, string>>;

Object.assign(messages.en, {
  "error.workingDirectory": "No working directory or binary path is set. Download or select NOALBS in Settings first.",
  "error.binaryMissing": "NOALBS binary not found. Download it or select its path first.",
  "error.notRunning": "NOALBS is not running.",
  "error.alreadyRunning": "NOALBS is already running.",
  "error.backupMissing": "No backup is available to restore.",
  "error.noAsset": "No release is available for this operating system or CPU architecture.",
  "error.io": "Unable to read or write a file. Check the path, file permissions, and available disk space.",
  "error.http": "The network request failed. Check your connection and try again.",
  "error.json": "The JSON format or configuration values are invalid. Check the configuration and try again.",
  "error.archive": "Unable to extract the download. Download it again and retry.",
  "error.unknown": "The operation failed. Expand the error details for more information.",
});

export function resolveLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const tag = language.toLowerCase();
    if (tag.startsWith("zh")) return /(?:tw|hk|mo|hant)/.test(tag) ? "zh-TW" : "zh-CN";
    const base = tag.split("-")[0];
    if (base === "en" || base === "ja" || base === "ko") return base;
  }
  return "en";
}

export function translate(locale: Locale, key: string, values: Record<string, string | number> = {}): string {
  const message = messages[locale][key] ?? messages.en[key] ?? key;
  return message.replace(/\{(\w+)\}/g, (match, name: string) => String(values[name] ?? match));
}
