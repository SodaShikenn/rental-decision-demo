"""Encode the captured UI and generate chapter/caption assets. Requires imageio-ffmpeg."""

from pathlib import Path
import json
import subprocess
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "output/playwright"
TARGET = ROOT / "web/demo/media"
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
TARGET.mkdir(parents=True, exist_ok=True)


def encode(*args):
    subprocess.run(
        [FFMPEG, "-hide_banner", "-loglevel", "error", "-y", *map(str, args)],
        check=True,
    )


encode(
    "-i",
    SOURCE / "walkthrough.webm",
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    TARGET / "walkthrough.mp4",
)
encode(
    "-ss",
    "2",
    "-i",
    TARGET / "walkthrough.mp4",
    "-frames:v",
    "1",
    "-q:v",
    "2",
    TARGET / "poster.jpg",
)
encode(
    "-ss",
    "2",
    "-t",
    "12",
    "-i",
    TARGET / "walkthrough.mp4",
    "-filter_complex",
    "fps=6,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4",
    "-loop",
    "0",
    SOURCE / "preview.gif",
)

recording = json.loads((SOURCE / "walkthrough-timings.json").read_text())
labels = [
    "Compare candidates",
    "Inspect the evidence",
    "Ask from real differences",
    "Confirm a priority",
    "Check the commute",
    "Read the decision brief",
    "Preview and export",
    "Explore the project",
]
japanese = [
    "検討中の候補から比較を始めます。画像と記録済みの掲載情報を使い、最初に希望を書く必要はありません。",
    "別室の参考価格は、候補の確定賃料にしません。根拠と部屋の一致を確認します。",
    "候補の違いから質問します。この動画のAI応答は録画専用の固定データです。画面と操作は実際のアプリです。",
    "回答だけでは希望を保存しません。提案された解釈を本人が確認してから比較に反映します。",
    "通勤先を選ぶと各候補の行き・帰りリンクを用意します。朝8時到着・夕18時出発はGoogle Maps側で設定します。",
    "確認した希望と次の質問をメモに自動でまとめます。手入力の内見日記ではありません。",
    "共有する内容を確認してHTML保存。期限付きリンクにはバックエンドが必要です。",
    "公開デモを試し、コードツアーで設計を確認できます。READMEから各ページへ進めます。",
]
chapters = [
    {**item, "start": round(item["start"], 2), "label": label, "ja": ja}
    for item, label, ja in zip(recording["chapters"], labels, japanese, strict=True)
]
(TARGET / "chapters.json").write_text(
    json.dumps(chapters, ensure_ascii=False, indent=2) + "\n"
)


def stamp(seconds):
    millis = round(seconds * 1000)
    return f"{millis // 3600000:02}:{millis // 60000 % 60:02}:{millis // 1000 % 60:02}.{millis % 1000:03}"


for language in ["en", "ja"]:
    lines = ["WEBVTT", ""]
    for index, chapter in enumerate(chapters):
        end = (
            chapters[index + 1]["start"]
            if index + 1 < len(chapters)
            else recording["duration"]
        )
        lines += [
            str(index + 1),
            f"{stamp(chapter['start'])} --> {stamp(end)}",
            chapter["ja"]
            if language == "ja"
            else chapter["title"] + "\n" + chapter["caption"],
            "",
        ]
    (TARGET / f"captions.{language}.vtt").write_text("\n".join(lines))

text = "# Rental Helper — walkthrough transcript\n\nSimulated demo. Recorded listing data and scripted AI responses; real application interactions.\n\n"
for chapter in chapters:
    text += f"## {stamp(chapter['start'])[:8]} — {chapter['title']}\n\n{chapter['caption']}\n\n{chapter['ja']}\n\n"
(TARGET / "transcript.md").write_text(text)
print(f"Encoded {recording['duration']:.1f}s and {len(chapters)} chapters in {TARGET}")
