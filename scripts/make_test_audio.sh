#!/usr/bin/env bash
set -euo pipefail

# Output directory
OUTPUT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/sample_audio"
mkdir -p "$OUTPUT_DIR"

OUTPUT_FILE="${OUTPUT_DIR}/test_speech_3min.wav"
OUTPUT_CORRUPT="${OUTPUT_DIR}/test_corrupt.wav"

echo "Generating 3-minute test audio with periodic silences..."

# Generate a 180s audio file with alternating beeps and silence intervals
# to test silence-aware chunking and transcription end-to-end.
ffmpeg -y -f lavfi -i "sine=frequency=440:duration=24" \
       -f lavfi -i "anullsrc=duration=1" \
       -f lavfi -i "sine=frequency=554:duration=24" \
       -f lavfi -i "anullsrc=duration=1" \
       -f lavfi -i "sine=frequency=659:duration=24" \
       -f lavfi -i "anullsrc=duration=1" \
       -f lavfi -i "sine=frequency=440:duration=24" \
       -f lavfi -i "anullsrc=duration=1" \
       -f lavfi -i "sine=frequency=554:duration=24" \
       -f lavfi -i "anullsrc=duration=1" \
       -f lavfi -i "sine=frequency=659:duration=24" \
       -f lavfi -i "anullsrc=duration=1" \
       -f lavfi -i "sine=frequency=440:duration=28" \
       -filter_complex "[0:a][1:a][2:a][3:a][4:a][5:a][6:a][7:a][8:a][9:a][10:a][11:a][12:a]concat=n=13:v=0:a=1[out]" \
       -map "[out]" -ar 16000 -ac 1 -c:a pcm_s16le "$OUTPUT_FILE"

echo "Created test audio file: $OUTPUT_FILE"

# Create a corrupt audio file for failure testing
echo "CORRUPT_AUDIO_HEADER_NOT_A_REAL_WAV_FILE" > "$OUTPUT_CORRUPT"
echo "Created corrupt test file: $OUTPUT_CORRUPT"

echo "Done! Test audio generated in sample_audio/"
