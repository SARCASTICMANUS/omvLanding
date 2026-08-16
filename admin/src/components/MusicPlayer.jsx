/**
 * YouTube music player.
 * - Songs/tracks       -> src/data/playlist.json (each entry: { title, id })
 * - Disc spin speed    -> animate-spin-slow (defined in tailwind.config.js)
 * - Disc gradient      -> the rounded-full disc div below (#009849 green family)
 */
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import playlistData from "../data/playlist.json";

const YOUTUBE_IFRAME_API =
  import.meta.env.VITE_YOUTUBE_IFRAME_API || "https://www.youtube.com/iframe_api";

// Songs to play, in order. Edit src/data/playlist.json to change the playlist.
const PLAYLIST = playlistData;

const PLAYER_STATES = {
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
};

export function MusicPlayer() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);

  const playerRef = useRef(null);
  const hostRef = useRef(null);
  const progressRef = useRef(null);
  const loadedIndexRef = useRef(-1);
  const advancingRef = useRef(false);

  const track = PLAYLIST[currentIndex];

  // Boots the hidden YouTube player (loads the IFrame API once) and autoplays.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const createPlayer = () => {
      if (!hostRef.current || !window.YT?.Player) return;

      playerRef.current = new window.YT.Player(hostRef.current, {
        videoId: PLAYLIST[0].id,
        playerVars: {
          playsinline: 1,
          rel: 0,
          controls: 0,
          modestbranding: 1,
        },
        events: {
          onReady: () => {
            setIsReady(true);
            playerRef.current?.playVideo();
          },
          onStateChange: (e) => {
            if (e.data === PLAYER_STATES.ENDED) {
              if (!advancingRef.current) {
                advancingRef.current = true;
                setCurrentIndex((i) => (i + 1) % PLAYLIST.length);
              }
              return;
            }

            const player = playerRef.current;
            if (player && (e.data === PLAYER_STATES.PLAYING || e.data === PLAYER_STATES.CUED)) {
              const d = player.getDuration();
              if (Number.isFinite(d) && d > 0) setDuration(d);
            }

            setIsPlaying(e.data === PLAYER_STATES.PLAYING);
          },
          onError: () => {
            setIsPlaying(false);
            if (!advancingRef.current) {
              advancingRef.current = true;
              setCurrentIndex((i) => (i + 1) % PLAYLIST.length);
            }
          },
        },
      });
    };

    const init = () => {
      if (window.YT?.Player) {
        createPlayer();
      } else {
        window.onYouTubeIframeAPIReady = createPlayer;
      }
    };

    if (!document.getElementById("youtube-iframe-api")) {
      const script = document.createElement("script");
      script.id = "youtube-iframe-api";
      script.src = YOUTUBE_IFRAME_API;
      script.async = true;
      script.onload = init;
      document.body.appendChild(script);
    } else {
      init();
    }

    return () => {
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, []);

  // Loads the next song when the current one ends or errors.
  useEffect(() => {
    if (!isReady || loadedIndexRef.current === currentIndex) return;

    const player = playerRef.current;
    const nextTrack = PLAYLIST[currentIndex];
    if (!player || !nextTrack) return;

    advancingRef.current = false;
    loadedIndexRef.current = currentIndex;
    player.loadVideoById({ videoId: nextTrack.id });
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(true);
  }, [isReady, currentIndex]);

  // Polls playback position 4x/sec to update the progress bar + time labels.
  useEffect(() => {
    if (!isPlaying) return;

    const id = setInterval(() => {
      const player = playerRef.current;
      if (!player) return;

      const time = player.getCurrentTime();
      if (Number.isFinite(time)) {
        setCurrentTime(time);
      }
    }, 250);

    return () => clearInterval(id);
  }, [isPlaying]);

  const togglePlay = () => {
    const player = playerRef.current;
    if (!player) return;

    if (isPlaying) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
  };

  const goPrev = () => {
    setCurrentIndex((i) => (i - 1 + PLAYLIST.length) % PLAYLIST.length);
  };

  const goNext = () => {
    setCurrentIndex((i) => (i + 1) % PLAYLIST.length);
  };

  const handleProgressClick = (e) => {
    const player = playerRef.current;
    const rect = progressRef.current?.getBoundingClientRect();

    if (!player || !rect || duration <= 0) return;

    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const target = ratio * duration;

    player.seekTo(target, true);
    setCurrentTime(target);
  };

  const formatTime = (seconds) => {
    const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    const minutes = Math.floor(safe / 60);
    const secs = Math.floor(safe % 60);
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const elapsed = Math.max(0, currentTime);
  const progress = duration > 0 ? (elapsed / duration) * 100 : 0;

  return (
    <div className="relative mt-40 flex h-[1px] w-[min(500px,calc(100vw-32px))] items-center rounded-[42px] border border-white/10 bg-[linear-gradient(15deg,rgba(6, 134, 168, 0.35),rgba(12, 145, 59, 0.3))] p-[8px_14px_8px_8px] text-white shadow-[0_14px_35px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.1)] backdrop-blur-[16px] max-[650px]:h-[70px] max-[650px]:rounded-[35px] max-[650px]:p-[6px_10px_6px_6px]">
      <div
        ref={hostRef}
        className="pointer-events-none absolute left-0 top-0 h-[1px] w-[1px] overflow-hidden opacity-0"
      />

      {/* Rotating disc. Size: h-16 w-16 (50px on small screens). Colors = VAYY green gradient. */}
      <div
        className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-[linear-gradient(145deg,#3ec87f_0%,#009849_38%,#007a3a_68%,#004d24_100%)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18),0_4px_15px_rgba(0,0,0,0.2)] animate-spin-slow max-[650px]:h-[50px] max-[650px]:w-[50px]"
        style={{ animationPlayState: isPlaying ? "running" : "paused" }}
        aria-hidden
      >
        <div className="absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.25),transparent_50%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(105deg,transparent_40%,rgba(255,255,255,0.16)_50%,transparent_60%)]" />
        <div className="absolute left-1/2 top-1/2 h-[11px] w-[11px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/60 bg-neutral-900 shadow-[0_0_0_3px_rgba(0,0,0,0.12)] max-[650px]:h-[9px] max-[650px]:w-[9px]" />
      </div>

      <div className="ml-[14px] mr-3 min-w-0 flex-1 max-[650px]:ml-2.5 max-[650px]:mr-2">
        <div className="mb-2 max-w-[430px] truncate text-[13px] font-bold [text-shadow:0_1px_2px_rgba(0,0,0,0.25)] max-[650px]:mb-1.5 max-[650px]:text-[11px]">
          {track.title}
        </div>

        <div
          ref={progressRef}
          onClick={handleProgressClick}
          className="w-full max-w-[360px] cursor-pointer"
        >
          <div className="mb-3 h-2 overflow-hidden rounded-[10px] bg-white/25">
            <div
              className="h-full rounded-[inherit] bg-[#f5f5f5] transition-[width] duration-200 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mt-1.5 text-[11px] text-white/80 [text-shadow:0_1px_2px_rgba(0,0,0,0.25)] max-[650px]:mt-1 max-[650px]:text-[9px]">
            {formatTime(elapsed)} / {formatTime(duration)}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-[14px] max-[650px]:gap-2">
        <button
          onClick={goPrev}
          className="cursor-pointer opacity-90 transition-opacity hover:opacity-100 max-[650px]:hidden"
          aria-label="Previous track"
        >
          <ChevronLeft className="h-4 w-4 text-white" />
        </button>

        <button
          onClick={togglePlay}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white text-neutral-900 shadow-[0_5px_16px_rgba(0,0,0,0.18)] transition-transform duration-150 hover:scale-[1.04] hover:shadow-[0_8px_20px_rgba(0,0,0,0.25)] max-[650px]:h-[34px] max-[650px]:w-[34px]"
        >
          {isPlaying ? (
            <Pause className="h-4 w-4 fill-neutral-900" />
          ) : (
            <Play className="ml-0.5 h-4 w-4 fill-neutral-900" />
          )}
        </button>

        <button
          onClick={goNext}
          className="cursor-pointer opacity-90 transition-opacity hover:opacity-100 max-[650px]:hidden"
          aria-label="Next track"
        >
          <ChevronRight className="h-4 w-4 text-white" />
        </button>
      </div>
    </div>
  );
}
