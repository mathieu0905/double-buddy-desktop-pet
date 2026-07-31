"use client";

import { useEffect, useMemo, useState } from "react";

type PetId = "lan" | "bo";
type Pet = { name: string; hunger: number; mood: number; energy: number };
type State = { selected: PetId; bond: number; pets: Record<PetId, Pet> };

const initialState: State = {
  selected: "lan",
  bond: 72,
  pets: {
    lan: { name: "阿蓝", hunger: 86, mood: 92, energy: 78 },
    bo: { name: "小博", hunger: 82, mood: 96, energy: 88 },
  },
};

const speeches: Record<PetId, Record<string, string[]>> = {
  lan: {
    tap: ["再摸一下也不是不行。", "好耶，充电成功。"],
    feed: ["吃饱了，才有力气摸鱼。", "这个饭团很有眼光。"],
    play: ["球来了——接住！", "小博，敢不敢再来一球？"],
    talk: ["我在听，你慢慢说。", "今天也辛苦啦。"],
    rest: ["那我眯五分钟……", "呼——先暂停营业。"],
  },
  bo: {
    tap: ["哈哈，再来一下！", "现在元气值爆表！"],
    feed: ["饭团满分，我宣布的。", "毕业之后也要好好吃饭！"],
    play: ["这一球我可不会让！", "来来来，决胜局！"],
    talk: ["讲吧，我保证认真听。", "先笑一个，办法总会有的。"],
    rest: ["只睡五分钟，真的。", "毕业袍可以当小被子。"],
  },
};

const effects = {
  tap: { hunger: 0, mood: 5, energy: 0, bond: 1 },
  feed: { hunger: 18, mood: 3, energy: 1, bond: 1 },
  play: { hunger: -6, mood: 15, energy: -10, bond: 3 },
  talk: { hunger: -1, mood: 9, energy: -1, bond: 2 },
  rest: { hunger: -2, mood: 2, energy: 20, bond: 1 },
};

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export default function Home() {
  const [state, setState] = useState<State>(initialState);
  const [speech, setSpeech] = useState({ pet: "lan" as PetId, text: "今天也一起摸鱼吧。" });
  const [motion, setMotion] = useState({ pet: "" as PetId | "", action: "" });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("double-buddy.sites.v1");
      if (saved) setState(JSON.parse(saved) as State);
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) window.localStorage.setItem("double-buddy.sites.v1", JSON.stringify(state));
  }, [state, ready]);

  const selected = state.pets[state.selected];
  const selectedName = selected.name;

  const moodText = useMemo(() => {
    if (selected.energy < 20) return "困到睁不开眼";
    if (selected.hunger < 25) return "肚子咕咕叫";
    if (selected.mood > 87) return "心情超好";
    return "悠闲自在";
  }, [selected]);

  function interact(petId: PetId, action: keyof typeof effects) {
    const effect = effects[action];
    setState((current) => {
      const pet = current.pets[petId];
      return {
        selected: petId,
        bond: clamp(current.bond + effect.bond),
        pets: {
          ...current.pets,
          [petId]: {
            ...pet,
            hunger: clamp(pet.hunger + effect.hunger),
            mood: clamp(pet.mood + effect.mood),
            energy: clamp(pet.energy + effect.energy),
          },
        },
      };
    });
    const options = speeches[petId][action];
    setSpeech({ pet: petId, text: options[Math.floor(Math.random() * options.length)] });
    setMotion({ pet: petId, action });
    window.setTimeout(() => setMotion({ pet: "", action: "" }), action === "rest" ? 2600 : 650);
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#home" aria-label="一起摸鱼首页">
          <span className="brand-mark"><i /><i /></span>
          <strong>一起摸鱼</strong>
          <small>DOUBLE BUDDY</small>
        </a>
        <nav aria-label="页面导航">
          <a href="#pets">认识他们</a>
          <a href="#care">在线陪伴</a>
          <a className="github-link" href="https://github.com/mathieu0905/double-buddy-desktop-pet" target="_blank" rel="noreferrer" aria-label="在 GitHub 查看一起摸鱼项目">GitHub ↗</a>
          <a className="nav-pill" href="#desktop">桌面版</a>
        </nav>
      </header>

      <section className="hero" id="home">
        <div className="hero-copy">
          <p className="eyebrow">TWO FRIENDS · ONE LITTLE DESKTOP</p>
          <h1>把我们的合照，<br /><em>变成每天见面的桌宠。</em></h1>
          <p className="lead">阿蓝和小博住进了这个小世界。点一点、喂个饭团、陪他们打一球——今天也有人陪你一起摸鱼。</p>
          <div className="hero-actions">
            <a className="primary" href="#care">现在去陪他们</a>
            <a className="secondary" href="#desktop">了解电脑桌宠版 <span>↗</span></a>
          </div>
          <div className="trust-row"><span>♥</span> 状态只保存在你的浏览器 · 无需登录</div>
        </div>

        <div className="portrait-stage" aria-label="阿蓝和小博的桌宠合照">
          <div className="stage-orbit" />
          <img className="hero-pet hero-lan" src="/assets/left-pet.png" alt="穿花衬衫的桌宠阿蓝" />
          <img className="hero-pet hero-bo" src="/assets/right-pet.png" alt="穿毕业袍的桌宠小博" />
          <div className="stage-label label-lan"><i />阿蓝 <small>温柔派</small></div>
          <div className="stage-label label-bo"><i />小博 <small>元气派</small></div>
          <div className="bond-seal"><span>♥</span><strong>{Math.round(state.bond)}</strong><small>默契</small></div>
        </div>
      </section>

      <section className="story-strip" id="pets">
        <p>从球场边的一张合照开始</p>
        <div><span>花衬衫与挎包</span><b>×</b><span>毕业袍与笑容</span><b>=</b><strong>两只独一无二的桌宠</strong></div>
      </section>

      <section className="playground" id="care">
        <div className="section-heading">
          <p className="eyebrow">LIVE COMPANION</p>
          <h2>现在，轮到你照顾他们了。</h2>
          <p>两只桌宠有独立的状态。选中一位，再决定今天一起做什么。</p>
        </div>

        <div className="pet-console">
          <div className="console-scene">
            <div className="speech"><strong>{state.pets[speech.pet].name}</strong>{speech.text}</div>
            {(["lan", "bo"] as PetId[]).map((petId) => (
              <button
                key={petId}
                className={`console-pet pet-${petId} ${state.selected === petId ? "selected" : ""} ${motion.pet === petId ? `motion-${motion.action}` : ""}`}
                onClick={() => interact(petId, "tap")}
                aria-label={`摸摸${state.pets[petId].name}`}
              >
                <img src={`/assets/${petId === "lan" ? "left" : "right"}-pet.png`} alt="" />
                <span><i />{state.pets[petId].name}<small>{petId === state.selected ? moodText : state.pets[petId].mood > 85 ? "元气满满" : "悠闲自在"}</small></span>
              </button>
            ))}
          </div>

          <div className="console-panel">
            <div className="panel-top">
              <div>
                <small>正在照顾</small>
                <h3>{selectedName}</h3>
              </div>
              <div className="pet-switch">
                {(["lan", "bo"] as PetId[]).map((petId) => (
                  <button key={petId} className={state.selected === petId ? "active" : ""} onClick={() => setState({ ...state, selected: petId })}>{state.pets[petId].name}</button>
                ))}
              </div>
            </div>

            <div className="needs">
              <Need label="饱腹" icon="◒" value={selected.hunger} />
              <Need label="心情" icon="♡" value={selected.mood} />
              <Need label="精力" icon="ϟ" value={selected.energy} />
            </div>

            <div className="actions">
              <Action emoji="🍙" label="喂食" onClick={() => interact(state.selected, "feed")} />
              <Action emoji="🏐" label="陪玩" onClick={() => interact(state.selected, "play")} />
              <Action emoji="💬" label="聊天" onClick={() => interact(state.selected, "talk")} />
              <Action emoji="☾" label="休息" onClick={() => interact(state.selected, "rest")} />
            </div>
          </div>
        </div>
      </section>

      <section className="desktop-callout" id="desktop">
        <div className="callout-copy">
          <p className="eyebrow">REAL DESKTOP PET</p>
          <h2>网页是小房间，<br />电脑桌面才是他们的家。</h2>
          <p>本地桌面版让两只角色直接站在桌面底部：透明背景、保持置顶、可以拖着走，也会自己散步和说话。</p>
          <div className="feature-list">
            <span>透明桌面悬浮</span><span>两只独立移动</span><span>右键快捷互动</span><span>自动保存状态</span>
          </div>
          <a className="github-cta" href="https://github.com/mathieu0905/double-buddy-desktop-pet" target="_blank" rel="noreferrer">前往 GitHub 下载与查看源码 <span>↗</span></a>
        </div>
        <div className="desktop-preview">
          <div className="fake-menubar"><i /><i /><i /><span>你的桌面</span></div>
          <div className="desktop-bubble">嘿，忙完记得休息一下。</div>
          <img src="/assets/left-pet.png" alt="阿蓝站在桌面上" />
          <img src="/assets/right-pet.png" alt="小博站在桌面上" />
          <div className="fake-dock"><i /><i /><i /><i /><i /></div>
        </div>
      </section>

      <footer>
        <div className="brand"><span className="brand-mark"><i /><i /></span><strong>一起摸鱼</strong></div>
        <p>由一张真实合照，长成两个会陪伴你的角色。</p>
        <div className="footer-links"><a href="https://github.com/mathieu0905/double-buddy-desktop-pet" target="_blank" rel="noreferrer">GitHub ↗</a><a href="#home">回到顶部 ↑</a></div>
      </footer>
    </main>
  );
}

function Need({ label, icon, value }: { label: string; icon: string; value: number }) {
  return (
    <div className="need">
      <span>{icon}</span>
      <div><small>{label}</small><i><b style={{ width: `${value}%` }} /></i></div>
      <strong>{Math.round(value)}</strong>
    </div>
  );
}

function Action({ emoji, label, onClick }: { emoji: string; label: string; onClick: () => void }) {
  return <button onClick={onClick}><span>{emoji}</span><strong>{label}</strong></button>;
}
