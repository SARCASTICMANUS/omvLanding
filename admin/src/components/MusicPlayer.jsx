import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import playlistData from "../data/playlist.json";

const YOUTUBE_IFRAME_API =
  import.meta.env.VITE_YOUTUBE_IFRAME_API || "https://www.youtube.com/iframe_api";

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
  const isNavigatingRef = useRef(false);

  const track = PLAYLIST[currentIndex];

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
              if (!isNavigatingRef.current) {
                setCurrentIndex((i) => (i + 1) % PLAYLIST.length);
              }
              return;
            }

            const player = playerRef.current;
            if (!player) return;

            if (e.data === PLAYER_STATES.PLAYING) {
              isNavigatingRef.current = false;
              const d = player.getDuration();
              if (Number.isFinite(d) && d > 0) setDuration(d);
            }

            if (e.data === PLAYER_STATES.CUED) {
              const d = player.getDuration();
              if (Number.isFinite(d) && d > 0) setDuration(d);
            }

            setIsPlaying(e.data === PLAYER_STATES.PLAYING);
          },
          onError: () => {
            isNavigatingRef.current = false;
            setIsPlaying(false);
            setCurrentIndex((i) => (i + 1) % PLAYLIST.length);
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

  useEffect(() => {
    if (!isReady || loadedIndexRef.current === currentIndex) return;

    const player = playerRef.current;
    const nextTrack = PLAYLIST[currentIndex];
    if (!player || !nextTrack) return;

    loadedIndexRef.current = currentIndex;
    player.loadVideoById({ videoId: nextTrack.id });
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(true);

    const safetyTimeout = setTimeout(() => {
      isNavigatingRef.current = false;
    }, 5000);

    return () => clearTimeout(safetyTimeout);
  }, [isReady, currentIndex]);

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
    isNavigatingRef.current = true;
    setCurrentIndex((i) => (i - 1 + PLAYLIST.length) % PLAYLIST.length);
  };

  const goNext = () => {
    isNavigatingRef.current = true;
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
    <div className="relative flex w-full items-center rounded-[28px] border border-white/10 bg-[linear-gradient(15deg,rgba(6,134,168,0.45),rgba(12,145,59,0.4))] p-[5px_8px_5px_5px] text-white shadow-[0_8px_24px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.1)] backdrop-blur-[16px] md:w-[min(500px,calc(100vw-32px))] md:rounded-[42px] md:p-[8px_14px_8px_8px] md:shadow-[0_14px_35px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.1)]">
      <div
        ref={hostRef}
        className="pointer-events-none absolute left-0 top-0 h-[1px] w-[1px] overflow-hidden opacity-0"
      />

      <div
        className="relative h-[42px] w-[42px] shrink-0 overflow-hidden rounded-full bg-[linear-gradient(145deg,#3ec87f_0%,#009849_38%,#007a3a_68%,#004d24_100%)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18),0_3px_10px_rgba(0,0,0,0.2)] animate-spin-slow md:h-16 md:w-16 md:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18),0_4px_15px_rgba(0,0,0,0.2)]"
        style={{ animationPlayState: isPlaying ? "running" : "paused" }}
        aria-hidden
      >
        <div className="absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.25),transparent_50%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(105deg,transparent_40%,rgba(255,255,255,0.16)_50%,transparent_60%)]" />
        <div className="absolute left-1/2 top-1/2 h-[8px] w-[8px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/60 bg-neutral-900 shadow-[0_0_0_2px_rgba(0,0,0,0.12)] md:h-[11px] md:w-[11px] md:shadow-[0_0_0_3px_rgba(0,0,0,0.12)]" />
      </div>

      <div className="ml-2.5 mr-1.5 min-w-0 flex-1 md:ml-[14px] md:mr-3">
        <div className="mb-1 truncate text-[11px] font-bold [text-shadow:0_1px_2px_rgba(0,0,0,0.25)] md:mb-2 md:max-w-[430px] md:text-[13px]">
          {track.title}
        </div>

        <div
          ref={progressRef}
          onClick={handleProgressClick}
          className="w-full cursor-pointer"
        >
          <div className="mb-1 h-1.5 overflow-hidden rounded-[8px] bg-white/25 md:mb-3 md:h-2 md:rounded-[10px]">
            <div
              className="h-full rounded-[inherit] bg-[#f5f5f5] transition-[width] duration-200 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="text-[9px] text-white/80 [text-shadow:0_1px_2px_rgba(0,0,0,0.25)] md:mt-1.5 md:text-[11px]">
            {formatTime(elapsed)} / {formatTime(duration)}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-[14px]">
        <button
          onClick={goPrev}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white/10 opacity-90 transition-opacity hover:opacity-100 md:h-auto md:w-auto md:rounded-none md:bg-transparent"
          aria-label="Previous track"
        >
          <ChevronLeft className="h-3.5 w-3.5 text-white md:h-4 md:w-4" />
        </button>

        <button
          onClick={togglePlay}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white text-neutral-900 shadow-[0_4px_12px_rgba(0,0,0,0.18)] transition-transform duration-150 hover:scale-[1.04] hover:shadow-[0_6px_16px_rgba(0,0,0,0.25)] md:h-10 md:w-10 md:shadow-[0_5px_16px_rgba(0,0,0,0.18)]"
        >
          {isPlaying ? (
            <Pause className="h-3.5 w-3.5 fill-neutral-900 md:h-4 md:w-4" />
          ) : (
            <Play className="ml-0.5 h-3.5 w-3.5 fill-neutral-900 md:h-4 md:w-4" />
          )}
        </button>

        <button
          onClick={goNext}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white/10 opacity-90 transition-opacity hover:opacity-100 md:h-auto md:w-auto md:rounded-none md:bg-transparent"
          aria-label="Next track"
        >
          <ChevronRight className="h-3.5 w-3.5 text-white md:h-4 md:w-4" />
        </button>
      </div>
    </div>
  );
}
