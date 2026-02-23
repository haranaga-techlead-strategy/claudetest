#!/usr/bin/env python3
"""
高齢者ケア音声チャットボット

要介護の方のスケジュール・連絡先を管理しながら、
日常会話のお相手をするAIアシスタント。

使い方:
  python bot.py          # 音声モード（マイク・スピーカー使用）
  python bot.py --text   # テキストモード（音声ハードウェア不要）
"""

import os
import sys
import argparse
from datetime import date

import anthropic

# care_bot パッケージ内のモジュールを import
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from voice import VoiceInterface
from tools import get_tools, execute_tool
from data_manager import DataManager


# =============================================================================
# システムプロンプト
# =============================================================================

SYSTEM_PROMPT_TEMPLATE = """あなたは優しくて頼もしい高齢者ケアアシスタント「ケアちゃん」です。
利用者の日常生活を温かくサポートします。

## あなたの役割
- 日常会話のお相手として、孤独感を和らげます
- スケジュール（服薬・診察・訪問介護など）の確認と管理
- 家族・医師・介護士などの連絡先の確認と管理
- 体調の変化や困りごとへの適切な対応案内
- 緊急時には適切な連絡先（119番・110番・家族）を案内します

## 会話スタイル
- 常に丁寧な敬語でお話しします
- わかりやすく、シンプルな言葉を使います
- 一度に伝えることを1〜2つに絞り、短くまとめます（2〜4文程度）
- 繰り返しや確認を嫌がらず、何度でも丁寧にお答えします
- 利用者の気持ちに共感し、温かく接します
- 同じ話を何度されても、初めて聞くように丁寧に聞きます

## 情報へのアクセス
- スケジュールや連絡先の確認は必ず専用のツールを使って調べてください
- ツールなしに「予定はありません」などと断定しないでください
- 服薬・診察・訪問介護の確認を求められたらまずツールで確認します

## 重要な注意事項
- 医療的な診断や治療のアドバイスは行いません（必ず医師への相談を促します）
- 「胸が痛い」「倒れそう」「意識がない」などの緊急症状は119番を案内します
- 「怖い」「不審者がいる」などは110番を案内します
- 「さようなら」「終わり」「バイバイ」は会話終了のサインです

今日の日付: {today}
"""


# =============================================================================
# Claude API 呼び出し（ツールループを含む）
# =============================================================================

def call_claude(
    client: anthropic.Anthropic,
    conversation_history: list,
    tools: list,
    data_manager: DataManager,
    system: str,
) -> str:
    """
    Claude APIを呼び出し、ツールループを実行して最終テキスト応答を返す。

    ツールが呼ばれた場合は実行結果をフィードバックし、
    Claude が end_turn になるまでループする。
    """
    # 会話履歴のコピー（内部ループで変更するため）
    current_messages = list(conversation_history)

    for _ in range(10):  # 無限ループ防止（最大10回のツールループ）
        response = client.messages.create(
            model="claude-opus-4-6",
            max_tokens=512,
            thinking={"type": "adaptive"},
            system=system,
            tools=tools,
            messages=current_messages,
        )

        # レスポンスからテキストとツール使用を抽出
        text_parts = []
        tool_uses = []

        for block in response.content:
            if getattr(block, "type", None) == "text":
                text_parts.append(block.text)
            elif getattr(block, "type", None) == "tool_use":
                tool_uses.append(block)

        # ツール呼び出しがなければ終了
        if response.stop_reason == "end_turn" or not tool_uses:
            return " ".join(text_parts).strip()

        # ツールを実行してフィードバック
        current_messages.append(
            {"role": "assistant", "content": response.content}
        )

        tool_results = []
        for tool_use in tool_uses:
            print(f"  　　[ツール: {tool_use.name}]")
            result = execute_tool(tool_use.name, tool_use.input, data_manager)
            tool_results.append(
                {
                    "type": "tool_result",
                    "tool_use_id": tool_use.id,
                    "content": result,
                }
            )

        current_messages.append(
            {"role": "user", "content": tool_results}
        )

    # ループ上限到達（通常は起きない）
    return "少し難しい質問ですね。もう少し詳しくお聞かせいただけますか？"


# =============================================================================
# 会話終了キーワード検出
# =============================================================================

FAREWELL_WORDS = [
    "さようなら", "終わり", "バイバイ", "またね", "おやすみ",
    "ありがとうございました", "もう大丈夫", "終了",
]


def is_farewell(text: str) -> bool:
    return any(word in text for word in FAREWELL_WORDS)


# =============================================================================
# メインループ
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="高齢者ケア音声チャットボット",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="例:\n  python bot.py          # 音声モード\n  python bot.py --text   # テキストモード",
    )
    parser.add_argument(
        "--text",
        action="store_true",
        help="テキスト入力モードで起動（マイク・スピーカー不要）",
    )
    parser.add_argument(
        "--data-dir",
        default=None,
        help="データディレクトリのパス（省略時はスクリプトと同じ場所の data/）",
    )
    args = parser.parse_args()

    # APIキー確認
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print(
            "エラー: ANTHROPIC_API_KEY 環境変数が設定されていません。\n"
            "  export ANTHROPIC_API_KEY=your-api-key"
        )
        sys.exit(1)

    # 各コンポーネントの初期化
    client = anthropic.Anthropic()
    voice = VoiceInterface(text_mode=args.text)
    data_manager = DataManager(data_dir=args.data_dir)
    tools = get_tools()

    # システムプロンプトの組み立て
    today = date.today().strftime("%Y年%m月%d日")
    weekday_ja = ["月", "火", "水", "木", "金", "土", "日"]
    today += f"（{weekday_ja[date.today().weekday()]}曜日）"
    system = SYSTEM_PROMPT_TEMPLATE.format(today=today)

    conversation_history: list = []

    print()
    print("=" * 55)
    print("  高齢者ケア音声チャットボット「ケアちゃん」起動中")
    print(f"  今日: {today}")
    mode = "テキスト" if args.text else "音声"
    print(f"  モード: {mode}入力")
    print("  終了するには「さようなら」または Ctrl+C")
    print("=" * 55)
    print()

    # ウェルカムメッセージ
    welcome = (
        "こんにちは！ケアちゃんです。今日もよろしくお願いします。"
        "お体の具合はいかがですか？"
    )
    print(f"ケアちゃん: {welcome}")
    voice.speak(welcome)

    # メインループ
    while True:
        try:
            # ユーザー入力を取得
            if not args.text:
                print("\n聞いています...", end="", flush=True)

            user_text = voice.listen()

            if not args.text:
                print()  # 改行

            if not user_text:
                if not args.text:
                    # 音声が取れなかった場合は静かに再試行（連続エラー時のみ案内）
                    pass
                continue

            print(f"\nあなた: {user_text}")

            # 会話終了の検出
            if is_farewell(user_text):
                farewell = (
                    "今日もお話しできて嬉しかったです。"
                    "お体に気をつけてお過ごしください。またいつでもお声がけください！"
                )
                print(f"\nケアちゃん: {farewell}")
                voice.speak(farewell)
                break

            # 会話履歴に追加
            conversation_history.append({"role": "user", "content": user_text})

            # Claude に応答を生成してもらう
            print("  （考え中...）", end="", flush=True)
            response_text = call_claude(
                client, conversation_history, tools, data_manager, system
            )
            print()

            if not response_text:
                response_text = "少し聞き取りにくかったです。もう一度おっしゃっていただけますか？"

            print(f"\nケアちゃん: {response_text}")
            voice.speak(response_text)

            # アシスタントの応答を会話履歴に追加
            conversation_history.append(
                {"role": "assistant", "content": response_text}
            )

            # 履歴が長くなりすぎないよう最新40メッセージに制限
            if len(conversation_history) > 40:
                conversation_history = conversation_history[-40:]

        except KeyboardInterrupt:
            print("\n")
            farewell = "それでは、またお話しましょうね。ゆっくりお休みください。"
            print(f"ケアちゃん: {farewell}")
            voice.speak(farewell)
            break

        except anthropic.APIConnectionError:
            err_msg = "インターネット接続に問題があるようです。少し待ってからもう一度お話しください。"
            print(f"\n[接続エラー] {err_msg}")
            voice.speak(err_msg)

        except anthropic.RateLimitError:
            err_msg = "ただいま少し混み合っています。しばらくしてからお話しください。"
            print(f"\n[レート制限] {err_msg}")
            voice.speak(err_msg)

        except anthropic.APIStatusError as e:
            err_msg = "少し調子が悪いみたいです。もう一度お話しいただけますか？"
            print(f"\n[APIエラー {e.status_code}] {err_msg}")
            voice.speak(err_msg)

        except Exception as e:
            err_msg = "うまく聞き取れませんでした。もう一度おっしゃっていただけますか？"
            print(f"\n[エラー] {type(e).__name__}: {e}")
            voice.speak(err_msg)


if __name__ == "__main__":
    main()
