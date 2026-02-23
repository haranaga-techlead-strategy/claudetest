"""
音声入出力モジュール
音声認識（STT）と音声合成（TTS）を提供する。
音声ライブラリが利用できない場合はテキストモードにフォールバックする。
"""

import os
import io
import tempfile
import sys

# --- ライブラリの可用性チェック ---

try:
    import speech_recognition as sr
    STT_AVAILABLE = True
except ImportError:
    STT_AVAILABLE = False

try:
    from gtts import gTTS
    import pygame
    TTS_AVAILABLE = True
    pygame.mixer.init()
except Exception:
    TTS_AVAILABLE = False

try:
    import pyttsx3
    PYTTSX3_AVAILABLE = True
except ImportError:
    PYTTSX3_AVAILABLE = False


class VoiceInterface:
    """
    音声入出力インターフェース。

    audio_mode=False の場合はテキスト入出力にフォールバックする。
    speech_recognition / gTTS が利用できない場合も自動でフォールバックする。
    """

    def __init__(self, text_mode: bool = False):
        self.text_mode = text_mode

        if not text_mode and not STT_AVAILABLE:
            print(
                "[情報] SpeechRecognitionが見つかりません。テキスト入力モードで起動します。\n"
                "       音声入力を有効にするには: pip install SpeechRecognition pyaudio"
            )
            self.text_mode = True

        if not text_mode and not TTS_AVAILABLE and not PYTTSX3_AVAILABLE:
            print(
                "[情報] TTSライブラリが見つかりません。テキスト出力のみで動作します。\n"
                "       音声出力を有効にするには: pip install gTTS pygame"
            )

        if not self.text_mode:
            self.recognizer = sr.Recognizer()
            # 環境ノイズに合わせてマイクを調整
            self._calibrate_microphone()

        self._pyttsx3_engine = None

    def _calibrate_microphone(self):
        """マイクの環境ノイズ調整を行う"""
        try:
            with sr.Microphone() as source:
                print("[情報] マイクを調整中... しばらくお待ちください。")
                self.recognizer.adjust_for_ambient_noise(source, duration=1)
            print("[情報] マイクの調整が完了しました。")
        except Exception as e:
            print(f"[警告] マイクの調整に失敗しました: {e}\nテキスト入力モードに切り替えます。")
            self.text_mode = True

    def listen(self) -> str:
        """
        音声またはテキストでユーザーの入力を受け取り、文字列で返す。
        聞き取れなかった場合は空文字列を返す。
        """
        if self.text_mode:
            try:
                return input("あなた: ").strip()
            except EOFError:
                return "さようなら"

        return self._listen_voice()

    def _listen_voice(self) -> str:
        """マイクから音声を録音してテキストに変換する"""
        try:
            with sr.Microphone() as source:
                audio = self.recognizer.listen(
                    source,
                    timeout=8,           # 発話開始タイムアウト（秒）
                    phrase_time_limit=20  # 最大発話時間（秒）
                )

            text = self.recognizer.recognize_google(audio, language="ja-JP")
            return text

        except sr.WaitTimeoutError:
            # タイムアウト（無音）は正常動作
            return ""
        except sr.UnknownValueError:
            # 音声を認識できなかった
            return ""
        except sr.RequestError as e:
            print(f"[エラー] 音声認識サービスに接続できません: {e}")
            return ""
        except Exception as e:
            print(f"[エラー] 音声入力エラー: {e}")
            return ""

    def speak(self, text: str):
        """
        テキストを音声で読み上げる。
        gTTS（Google TTS）が優先。失敗時は pyttsx3 にフォールバック。
        テキストモード時は何もしない（print は呼び出し元で行う）。
        """
        if self.text_mode:
            return

        if TTS_AVAILABLE:
            self._speak_gtts(text)
        elif PYTTSX3_AVAILABLE:
            self._speak_pyttsx3(text)
        # どちらも利用できない場合はスキップ（テキスト表示のみ）

    def _speak_gtts(self, text: str):
        """gTTS + pygame で音声再生する"""
        tmp_path = None
        try:
            tts = gTTS(text=text, lang="ja", slow=False)

            # 一時ファイルに保存して pygame で再生
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
                tmp_path = tmp.name
            tts.save(tmp_path)

            pygame.mixer.music.load(tmp_path)
            pygame.mixer.music.play()

            # 再生が終わるまで待機
            while pygame.mixer.music.get_busy():
                pygame.time.Clock().tick(10)

        except Exception as e:
            print(f"[警告] gTTSでの音声出力に失敗しました: {e}")
            if PYTTSX3_AVAILABLE:
                self._speak_pyttsx3(text)
        finally:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass

    def _speak_pyttsx3(self, text: str):
        """pyttsx3 でオフライン音声合成を行う（フォールバック用）"""
        try:
            if self._pyttsx3_engine is None:
                self._pyttsx3_engine = pyttsx3.init()
                # 話速を少し遅めに設定（高齢者向け）
                self._pyttsx3_engine.setProperty("rate", 140)

            self._pyttsx3_engine.say(text)
            self._pyttsx3_engine.runAndWait()
        except Exception as e:
            print(f"[警告] pyttsx3での音声出力に失敗しました: {e}")
