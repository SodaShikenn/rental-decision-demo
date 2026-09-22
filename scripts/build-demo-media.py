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
recording = json.loads((SOURCE / "walkthrough-timings.json").read_text())
if recording.get("environment") != "local-live-api" or len(recording["chapters"]) != 13:
    raise ValueError("A successful live recording with all 13 chapters is required")


# The browser CLI starts capture before the journey's clock. Measure that lead-in
# from the first caption change, so chapter links land on the intended scene.
preview = subprocess.check_output(
    [
        FFMPEG,
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        str(SOURCE / "walkthrough.webm"),
        "-t",
        "4",
        "-vf",
        "fps=25,crop=1360:80:32:910,scale=340:20",
        "-pix_fmt",
        "gray",
        "-f",
        "rawvideo",
        "-",
    ]
)
frame_size = 340 * 20
baseline = preview[:frame_size]
lead_in = 0.0
for index in range(1, len(preview) // frame_size):
    frame = preview[index * frame_size : (index + 1) * frame_size]
    changed = sum(abs(a - b) > 40 for a, b in zip(baseline, frame))
    if changed / frame_size > 0.03:
        lead_in = index / 25
        break
for chapter in recording["chapters"][1:]:
    chapter["start"] += lead_in
recording["duration"] += lead_in
print(f"Aligned chapters with {lead_in:.2f}s of recording lead-in")


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

chapters = [
    {**item, "start": round(item["start"], 2)} for item in recording["chapters"]
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

text = f"# Rental Helper — walkthrough transcript\n\nRecorded {recording['recordedAt'][:10]} against a local app with live Gemini and Google Maps APIs. Starting candidates are recorded listings. No API responses are scripted. This is not a public hosted-app demonstration.\n\n"
for chapter in chapters:
    text += f"## {stamp(chapter['start'])[:8]} — {chapter['title']}\n\n{chapter['caption']}\n\n{chapter['ja']}\n\n"
(TARGET / "transcript.md").write_text(text)
print(f"Encoded {recording['duration']:.1f}s and {len(chapters)} chapters in {TARGET}")
