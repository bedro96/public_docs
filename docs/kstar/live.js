function setupLessons(videos) {
  const root = document.documentElement;
  const theme = document.querySelector(".theme");
  theme.addEventListener("click", () => {
    const dark = root.dataset.theme !== "dark";
    root.dataset.theme = dark ? "dark" : "light";
    theme.setAttribute("aria-pressed", String(dark));
  });

  const activeVideos = [...document.querySelectorAll(".lesson video")];
  const footage = [...document.querySelectorAll(".footage-load")].map((button) => ({
    button,
    mount: document.getElementById(button.getAttribute("aria-controls")),
    label: button.textContent,
  }));
  const closeFootage = ({ button, mount, label }) => {
    if (mount.hidden) return;
    mount.replaceChildren();
    mount.hidden = true;
    button.textContent = label;
    button.setAttribute("aria-expanded", "false");
  };
  const all = document.querySelector("#play-all");
  const playlist = [];
  let playingAll = false;
  const setPlaylist = (next) => {
    playingAll = next;
    all.setAttribute("aria-pressed", String(next));
    all.textContent = next ? "전체 자동 재생 끄기" : "전체 영상 자동 재생";
    playlist.forEach((lesson) => lesson.auto(false));
  };
  const pauseLessons = (except) => activeVideos.forEach((video) => {
    if (video !== except && !video.paused) video.pause();
  });
  for (const [group, lesson] of [...document.querySelectorAll(".lesson")].entries()) {
    const find = (selector) => lesson.querySelector(selector);
    const chapters = [...lesson.querySelectorAll("[data-chapter]")];
    const text = [...lesson.querySelectorAll(".chapter-text > li")];
    const video = find("video");
    const start = find(".video-start");
    const poster = find(".video-poster");
    const auto = find(".lesson-auto");
    const prev = find(".lesson-prev");
    const next = find(".lesson-next");
    const status = find(".lesson-status");
    let index = 0, autoplay = false, loaded = false, selection = 0;
    const setAuto = (next) => {
      autoplay = next;
      auto.setAttribute("aria-pressed", String(next));
    };
    playlist.push({
      auto: setAuto,
      begin() {
        setAuto(true);
        select(0, true);
        lesson.scrollIntoView({ behavior: "instant", block: "start" });
      },
    });

    function select(i, shouldPlay = false) {
      selection++;
      index = i;
      loaded = false;
      video.pause();
      video.removeAttribute("src");
      video.load();
      video.hidden = true;
      poster.hidden = false;
      start.hidden = false;
      prev.disabled = i === 0;
      next.disabled = i === chapters.length - 1;
      chapters.forEach((button, pos) => button.setAttribute("aria-current", pos === i ? "step" : "false"));
      find(".lesson-readout").textContent = `${i + 1} / ${chapters.length}`;
      find(".chapter-description").replaceChildren(...[...text[i].children].map((node) => node.cloneNode(true)));
      status.textContent = "재생을 누르면 음성이 시작됩니다.";
      if (shouldPlay) play();
    }

    async function play() {
      const currentSelection = selection;
      pauseLessons(video);
      if (!loaded) {
        loaded = true;
        video.src = `data:video/mp4;base64,${videos[chapters[index].dataset.chapter]}`;
        video.hidden = false;
        poster.hidden = true;
        start.hidden = true;
      }
      try {
        await video.play();
        if (selection === currentSelection && !video.ended) status.textContent = autoplay ? "재생 중 · 다음 영상으로 자동 이동" : "재생 중";
      } catch {
        if (selection !== currentSelection || !loaded) return;
        if (video.error) {
          status.textContent = "이 브라우저에서 영상을 재생할 수 없습니다. 아래 음성 대본을 읽어 주세요.";
          return;
        }
        status.textContent = "자동 재생이 차단되었습니다. 영상의 재생 버튼을 눌러 주세요.";
      }
    }

    video.addEventListener("play", () => {
      if (playingAll && !autoplay) setPlaylist(false);
      pauseLessons(video);
      footage.forEach(closeFootage);
      status.textContent = autoplay ? "재생 중 · 다음 영상으로 자동 이동" : "재생 중";
    });
    video.addEventListener("pause", () => {
      if (loaded && !video.ended) status.textContent = "일시 정지";
    });
    video.addEventListener("error", () => {
      if (loaded) status.textContent = "영상을 읽지 못했습니다. 아래 음성 대본을 읽어 주세요.";
    });
    video.addEventListener("ended", () => {
      if (!loaded || !video.ended) return;
      if (autoplay && index < chapters.length - 1) {
        select(index + 1, true);
      } else {
        status.textContent = index === chapters.length - 1 ? "마지막 단계 재생이 끝났습니다." : "재생 완료 · 다음 단계로 이동할 수 있습니다.";
        if (index === chapters.length - 1) {
          setAuto(false);
          if (playingAll && playlist[group + 1]) playlist[group + 1].begin();
          else if (playingAll) setPlaylist(false);
        }
      }
    });
    start.addEventListener("click", () => {
      play();
      video.focus();
    });
    auto.addEventListener("click", () => {
      const nextState = !autoplay;
      if (playingAll) setPlaylist(false);
      setAuto(nextState);
      if (autoplay && video.ended) select(index < chapters.length - 1 ? index + 1 : 0, true);
      else if (autoplay) play();
      else status.textContent = "자동 넘김 꺼짐";
    });
    prev.addEventListener("click", () => select(index - 1, true));
    next.addEventListener("click", () => select(index + 1, true));
    chapters.forEach((chapter, i) => {
      chapter.addEventListener("click", () => select(i, true));
      chapter.addEventListener("keydown", (event) => {
        const offsets = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 };
        if (!(event.key in offsets) && event.key !== "Home" && event.key !== "End") return;
        event.preventDefault();
        const target = event.key === "Home" ? 0 : event.key === "End" ? chapters.length - 1 :
          Math.max(0, Math.min(chapters.length - 1, i + offsets[event.key]));
        chapters[target].focus();
      });
    });
    select(0);
    find(".chapter-text").hidden = true;
  }

  all.addEventListener("click", () => {
    if (playingAll) {
      setPlaylist(false);
      pauseLessons();
    } else {
      setPlaylist(true);
      playlist[0].begin();
    }
  });

  for (const entry of footage) {
    const { button, mount } = entry;
    button.addEventListener("click", () => {
      if (!mount.hidden) {
        closeFootage(entry);
        return;
      }
      if (playingAll) setPlaylist(false);
      pauseLessons();
      footage.forEach(closeFootage);
      const iframe = document.createElement("iframe");
      iframe.src = `https://www.youtube-nocookie.com/embed/${button.dataset.video}`;
      iframe.title = button.dataset.title;
      iframe.allow = "encrypted-media; picture-in-picture; fullscreen";
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = "strict-origin-when-cross-origin";
      mount.replaceChildren(iframe);
      mount.hidden = false;
      button.textContent = "영상 닫기";
      button.setAttribute("aria-expanded", "true");
    });
  }
  root.dataset.enhanced = "";
}
