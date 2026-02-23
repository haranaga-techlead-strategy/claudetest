"""
Claudeが使用するツールの定義と実装
スケジュール管理・連絡先管理のツールを提供する
"""

import json
from datetime import date, datetime, timedelta
from data_manager import DataManager


def get_tools() -> list:
    """Claude APIに渡すツール定義の一覧を返す"""
    return [
        {
            "name": "get_today_schedule",
            "description": (
                "今日のスケジュールを取得します。"
                "服薬、診察、訪問介護、家族の来訪など今日の全予定を確認できます。"
            ),
            "input_schema": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
        {
            "name": "get_upcoming_schedule",
            "description": (
                "今日から指定した日数分の今後のスケジュールを取得します。"
                "「今週の予定は？」「次の診察はいつ？」などの質問に使います。"
            ),
            "input_schema": {
                "type": "object",
                "properties": {
                    "days": {
                        "type": "integer",
                        "description": "取得する日数（例: 7で1週間分、14で2週間分）",
                    }
                },
                "required": ["days"],
            },
        },
        {
            "name": "add_event",
            "description": (
                "新しい予定をスケジュールに追加します。"
                "診察、服薬、訪問介護、家族の来訪などを登録できます。"
            ),
            "input_schema": {
                "type": "object",
                "properties": {
                    "date": {
                        "type": "string",
                        "description": "予定の日付（YYYY-MM-DD形式、例: 2026-03-10）",
                    },
                    "time": {
                        "type": "string",
                        "description": "予定の時刻（HH:MM形式、例: 14:00）",
                    },
                    "title": {
                        "type": "string",
                        "description": "予定のタイトル（例: 内科診察、訪問介護）",
                    },
                    "description": {
                        "type": "string",
                        "description": "予定の詳細説明（任意）",
                    },
                    "type": {
                        "type": "string",
                        "description": (
                            "予定の種類: "
                            "medication（服薬）/ medical（診察）/ care_visit（訪問介護）/ "
                            "family（家族）/ rehabilitation（リハビリ）/ other（その他）"
                        ),
                    },
                },
                "required": ["date", "time", "title"],
            },
        },
        {
            "name": "get_contacts",
            "description": (
                "連絡先の一覧を取得します。"
                "家族、担当医、介護士、緊急連絡先などを確認できます。"
                "特定の続柄で絞り込むこともできます。"
            ),
            "input_schema": {
                "type": "object",
                "properties": {
                    "relation": {
                        "type": "string",
                        "description": (
                            "絞り込む続柄・関係（任意）"
                            "例: 息子、娘、担当医、訪問介護士、ケアマネージャー、緊急連絡"
                        ),
                    }
                },
                "required": [],
            },
        },
        {
            "name": "search_contact",
            "description": (
                "名前や続柄で連絡先を検索します。"
                "「お医者さんの電話番号は？」「息子に電話したい」などの時に使います。"
            ),
            "input_schema": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "検索キーワード（名前、続柄、病院名など）",
                    }
                },
                "required": ["query"],
            },
        },
        {
            "name": "add_contact",
            "description": "新しい連絡先を追加します。",
            "input_schema": {
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "氏名（例: 田中太郎）",
                    },
                    "relation": {
                        "type": "string",
                        "description": "続柄・関係（例: 息子、担当医、訪問介護士）",
                    },
                    "phone": {
                        "type": "string",
                        "description": "電話番号（例: 090-1234-5678）",
                    },
                    "notes": {
                        "type": "string",
                        "description": "メモ・備考（任意）",
                    },
                },
                "required": ["name", "relation", "phone"],
            },
        },
    ]


def execute_tool(tool_name: str, tool_input: dict, data_manager: DataManager) -> str:
    """
    ツールを実行して結果を文字列で返す。
    Claudeの tool_result に渡す。
    """
    try:
        if tool_name == "get_today_schedule":
            return _get_today_schedule(data_manager)
        elif tool_name == "get_upcoming_schedule":
            days = int(tool_input.get("days", 7))
            return _get_upcoming_schedule(data_manager, days)
        elif tool_name == "add_event":
            return _add_event(data_manager, tool_input)
        elif tool_name == "get_contacts":
            return _get_contacts(data_manager, tool_input.get("relation"))
        elif tool_name == "search_contact":
            return _search_contact(data_manager, tool_input.get("query", ""))
        elif tool_name == "add_contact":
            return _add_contact(data_manager, tool_input)
        else:
            return f"不明なツール: {tool_name}"
    except Exception as e:
        return f"ツール実行エラー（{tool_name}）: {str(e)}"


def _get_today_schedule(data_manager: DataManager) -> str:
    today = date.today().isoformat()
    events = data_manager.get_events_for_date(today)

    today_str = date.today().strftime("%Y年%m月%d日（%A）")
    # 曜日を日本語に変換
    weekday_ja = ["月", "火", "水", "木", "金", "土", "日"]
    today_str = date.today().strftime("%Y年%m月%d日")
    today_str += f"（{weekday_ja[date.today().weekday()]}曜日）"

    if not events:
        return f"{today_str}の予定はありません。"

    lines = [f"{today_str}の予定:"]
    for event in sorted(events, key=lambda x: x.get("time", "00:00")):
        line = f"・{event.get('time', '時間未定')}: {event.get('title', '')}"
        if event.get("description"):
            line += f"\n  　{event['description']}"
        lines.append(line)
    return "\n".join(lines)


def _get_upcoming_schedule(data_manager: DataManager, days: int) -> str:
    today = date.today()
    end_date = today + timedelta(days=days - 1)
    events = data_manager.get_events_in_range(today.isoformat(), end_date.isoformat())

    if not events:
        return f"今後{days}日間の予定はありません。"

    weekday_ja = ["月", "火", "水", "木", "金", "土", "日"]

    # 日付ごとにグループ化
    events_by_date: dict[str, list] = {}
    for event in events:
        d = event.get("date", "")
        events_by_date.setdefault(d, []).append(event)

    lines = [f"今後{days}日間の予定:"]
    for event_date in sorted(events_by_date.keys()):
        dt = datetime.strptime(event_date, "%Y-%m-%d")
        label = dt.strftime("%m月%d日")
        label += f"（{weekday_ja[dt.weekday()]}）"
        if event_date == today.isoformat():
            label += " ← 今日"
        lines.append(f"\n【{label}】")
        for event in sorted(events_by_date[event_date], key=lambda x: x.get("time", "00:00")):
            lines.append(f"  ・{event.get('time', '時間未定')}: {event.get('title', '')}")

    return "\n".join(lines)


def _add_event(data_manager: DataManager, tool_input: dict) -> str:
    event = {
        "date": tool_input.get("date", ""),
        "time": tool_input.get("time", ""),
        "title": tool_input.get("title", ""),
        "description": tool_input.get("description", ""),
        "type": tool_input.get("type", "other"),
    }
    new_id = data_manager.add_event(event)
    date_str = event["date"]
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        date_str = dt.strftime("%m月%d日")
    except ValueError:
        pass
    return f"予定を追加しました（ID:{new_id}）: {date_str} {event['time']} 「{event['title']}」"


def _get_contacts(data_manager: DataManager, relation: str = None) -> str:
    if relation:
        contacts = data_manager.get_contacts_by_relation(relation)
        if not contacts:
            return f"「{relation}」の連絡先が見つかりません。"
        lines = [f"【{relation}】の連絡先:"]
    else:
        contacts = data_manager.get_all_contacts()
        if not contacts:
            return "連絡先が登録されていません。"
        lines = ["連絡先一覧:"]

    for c in contacts:
        line = f"・{c.get('name', '')}（{c.get('relation', '')}）"
        if c.get("phone"):
            line += f": {c['phone']}"
        if c.get("hospital"):
            line += f" ／ {c['hospital']}"
        lines.append(line)

    return "\n".join(lines)


def _search_contact(data_manager: DataManager, query: str) -> str:
    contacts = data_manager.search_contacts(query)
    if not contacts:
        return f"「{query}」に一致する連絡先が見つかりません。"

    lines = [f"「{query}」の検索結果:"]
    for c in contacts:
        lines.append(f"\n・{c.get('name', '')}（{c.get('relation', '')}）")
        if c.get("phone"):
            lines.append(f"  電話: {c['phone']}")
        if c.get("hospital"):
            lines.append(f"  病院: {c['hospital']}")
        if c.get("specialty"):
            lines.append(f"  専門: {c['specialty']}")
        if c.get("notes"):
            lines.append(f"  メモ: {c['notes']}")

    return "\n".join(lines)


def _add_contact(data_manager: DataManager, tool_input: dict) -> str:
    contact = {
        "name": tool_input.get("name", ""),
        "relation": tool_input.get("relation", ""),
        "phone": tool_input.get("phone", ""),
        "notes": tool_input.get("notes", ""),
    }
    data_manager.add_contact(contact)
    return f"連絡先を追加しました: {contact['name']}（{contact['relation']}）{contact['phone']}"
