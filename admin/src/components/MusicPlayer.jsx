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

export function MusicPlayer({ ctaButton }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);

  const playerRef = useRef(null);
  const hostRef = useRef(null);
  const loadedIndexRef = useRef(-1);
  const isNavigatingRef = useRef(false);

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
            const tryPlay = () => {
              playerRef.current?.playVideo();
            };
            tryPlay();
            const handler = () => {
              tryPlay();
              document.removeEventListener("click", handler);
              document.removeEventListener("touchstart", handler);
            };
            document.addEventListener("click", handler);
            document.addEventListener("touchstart", handler);
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

  const elapsed = Math.max(0, currentTime);
  const progress = duration > 0 ? (elapsed / duration) * 100 : 0;

  return (
    <div className="relative flex w-full flex-col items-center gap-3 rounded-[30px] border border-white/10 bg-[linear-gradient(15deg,rgba(0, 200, 255, 0.45),rgba(145, 87, 12, 0.4))] px-4 py-3 text-white shadow-[0_8px_24px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.1)] 
    backdrop-blur-[16px] md:w-[min(350px,calc(100vw-32px))] md:rounded-[30px] md:flex-row md:items-center md:justify-between md:gap-3 md:px-5 md:py-3 w-[180px]">
      <div
        ref={hostRef}
        className="pointer-events-none absolute left-0 top-0 h-[1px] w-[1px] overflow-hidden opacity-0"
      />

      {/* Join CTA */}
      {ctaButton}

      {/* Controls row: Prev + Ring Play/Pause + Next */}
      <div className="flex shrink-0 items-center gap-2 md:gap-4">
        <button
          onClick={goPrev}
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-white/10 transition-opacity hover:bg-white/20 md:h-8 md:w-8 "
          aria-label="Previous track"
        >
          <ChevronLeft className="h-3.5 w-3.5 text-white md:h-4 md:w-4" />
        </button>

        {/* Ring progress + Play/Pause */}
        <button
          onClick={togglePlay}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="relative flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center md:h-11 md:w-11"
        >
          <svg
            className="absolute inset-0 -rotate-90"
            width="45"
            height="45"
            viewBox="0 0 40 40"
          >
            <circle
              cx="21"
              cy="18"
              r="18"
              fill="none"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="3"
            />
            <circle
              cx="21"
              cy="19"
              r="17"
              fill="none"
              stroke="#ffffff"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={106.81}
              strokeDashoffset={106.81 - (progress / 100) * 106.81}
              className="transition-[stroke-dashoffset] duration-200 ease-linear"
            />
          </svg>
          <span className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] md:h-8 md:w-8">
            {isPlaying ? (
              <Pause className="h-3.5 w-3.5 fill-neutral-900 md:h-4 md:w-4" />
            ) : (
              <Play className="ml-0.5 h-3.5 w-3.5 fill-neutral-900 md:h-4 md:w-4" />
            )}
          </span>
        </button>

        <button
          onClick={goNext}
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-white/10 transition-opacity hover:bg-white/20 md:h-8 md:w-8"
          aria-label="Next track"
        >
          <ChevronRight className="h-3.5 w-3.5 text-white md:h-4 md:w-4" />
        </button>
      </div>
    </div>
  );
}
