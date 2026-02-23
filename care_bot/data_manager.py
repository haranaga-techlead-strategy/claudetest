"""
データ管理モジュール
スケジュールと連絡先のJSONファイルを読み書きする
"""

import json
import os
from datetime import date, datetime
from pathlib import Path


class DataManager:
    def __init__(self, data_dir: str = None):
        if data_dir is None:
            data_dir = Path(__file__).parent / "data"
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(exist_ok=True)
        self.schedule_file = self.data_dir / "schedule.json"
        self.contacts_file = self.data_dir / "contacts.json"
        self._init_files()

    def _init_files(self):
        """データファイルが存在しない場合は初期化する"""
        if not self.schedule_file.exists():
            self._save_json(self.schedule_file, {"events": []})
        if not self.contacts_file.exists():
            self._save_json(self.contacts_file, {"contacts": []})

    def _load_json(self, file_path: Path) -> dict:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _save_json(self, file_path: Path, data: dict):
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    # --- スケジュール操作 ---

    def get_events_for_date(self, date_str: str) -> list:
        """指定した日付のイベントを取得する"""
        data = self._load_json(self.schedule_file)
        return [e for e in data["events"] if e.get("date") == date_str]

    def get_events_in_range(self, start_date: str, end_date: str) -> list:
        """指定した日付範囲のイベントを取得する"""
        data = self._load_json(self.schedule_file)
        return [
            e
            for e in data["events"]
            if start_date <= e.get("date", "") <= end_date
        ]

    def add_event(self, event: dict):
        """新しいイベントをスケジュールに追加する"""
        data = self._load_json(self.schedule_file)
        # 一意なIDを付与
        existing_ids = {e.get("id", "0") for e in data["events"]}
        new_id = str(max((int(i) for i in existing_ids if i.isdigit()), default=0) + 1)
        event["id"] = new_id
        data["events"].append(event)
        self._save_json(self.schedule_file, data)
        return new_id

    def delete_event(self, event_id: str) -> bool:
        """指定したIDのイベントを削除する"""
        data = self._load_json(self.schedule_file)
        original_count = len(data["events"])
        data["events"] = [e for e in data["events"] if e.get("id") != event_id]
        if len(data["events"]) < original_count:
            self._save_json(self.schedule_file, data)
            return True
        return False

    # --- 連絡先操作 ---

    def get_all_contacts(self) -> list:
        """全連絡先を取得する"""
        data = self._load_json(self.contacts_file)
        return data.get("contacts", [])

    def get_contacts_by_relation(self, relation: str) -> list:
        """続柄・関係で連絡先を絞り込む"""
        contacts = self.get_all_contacts()
        return [
            c for c in contacts
            if relation in c.get("relation", "")
        ]

    def search_contacts(self, query: str) -> list:
        """名前・続柄・専門・病院名で連絡先を検索する"""
        contacts = self.get_all_contacts()
        query_lower = query.lower()
        results = []
        for c in contacts:
            if any(
                query_lower in str(c.get(field, "")).lower()
                for field in ["name", "relation", "specialty", "hospital", "notes"]
            ):
                results.append(c)
        return results

    def add_contact(self, contact: dict):
        """新しい連絡先を追加する"""
        data = self._load_json(self.contacts_file)
        data["contacts"].append(contact)
        self._save_json(self.contacts_file, data)
