import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { VayyCard } from "../components/vayy";
import TOS_MD from "../data/tosContent";

function parseMd(md) {
  const lines = md.split("\n");
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("# ")) {
      blocks.push({ type: "h1", text: line.slice(2).trim() });
      i++;
    } else if (line.startsWith("## ")) {
      blocks.push({ type: "h2", text: line.slice(3).trim() });
      i++;
    } else if (line.startsWith("> ")) {
      let quote = line.slice(2);
      i++;
      while (i < lines.length && lines[i].startsWith("> ")) {
        quote += " " + lines[i].slice(2);
        i++;
      }
      blocks.push({ type: "quote", text: quote.trim() });
    } else if (line.startsWith("- ")) {
      const items = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(lines[i].slice(2).trim());
        i++;
      }
      blocks.push({ type: "list", items });
    } else if (line.startsWith("---")) {
      blocks.push({ type: "hr" });
      i++;
    } else if (line.trim() === "") {
      i++;
    } else {
      let para = line;
      i++;
      while (
        i < lines.length &&
        lines[i].trim() !== "" &&
        !lines[i].startsWith("#") &&
        !lines[i].startsWith("- ") &&
        !lines[i].startsWith("> ") &&
        !lines[i].startsWith("---")
      ) {
        para += " " + lines[i];
        i++;
      }
      blocks.push({ type: "p", text: para.trim() });
    }
  }
  return blocks;
}

function renderInline(text) {
  const parts = [];
  const regex = /\*\*(.*?)\*\*/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <strong key={match.index} className="font-bold text-[#111827]">
        {match[1]}
      </strong>,
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

export default function TermsPage() {
  const navigate = useNavigate();
  const blocks = useMemo(() => parseMd(TOS_MD), []);

  // Group parsed blocks into an intro block plus one card per `##` section.
  const { preamble, sections } = useMemo(() => {
    const intro = [];
    const grouped = [];
    let current = null;
    blocks.forEach((block) => {
      if (block.type === "h2") {
        current = { title: block.text, blocks: [] };
        grouped.push(current);
      } else if (current) {
        current.blocks.push(block);
      } else {
        intro.push(block);
      }
    });
    return { preamble: intro, sections: grouped };
  }, [blocks]);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  const renderBlock = (block, i) => {
    if (block.type === "h1") {
      return (
        <h2 key={i} className="mb-2 mt-1 text-[20px] font-extrabold tracking-tight text-[#111827]">
          {block.text}
        </h2>
      );
    }
    if (block.type === "h2") {
      return (
        <h3 key={i} className="mb-2 mt-5 text-[16px] font-bold text-[#111827]">
          {block.text}
        </h3>
      );
    }
    if (block.type === "quote") {
      return (
        <div key={i} className="mb-4 rounded-[12px] border border-[#FDE68A] bg-[#FFFBEB] p-3.5">
          <p className="mb-1 text-[12px] font-bold text-[#92400E]">Important</p>
          <p className="text-[12px] leading-[17px] text-[#78350F]">{renderInline(block.text)}</p>
        </div>
      );
    }
    if (block.type === "list") {
      return (
        <ul key={i} className="mb-3 ml-1">
          {block.items.map((item, j) => (
            <li key={j} className="mb-1 flex gap-2">
              <span aria-hidden="true" className="font-bold text-[#009849]">
                •
              </span>
              <span className="min-w-0 text-[13px] font-medium leading-[19px] text-[#6B7280]">
                {renderInline(item)}
              </span>
            </li>
          ))}
        </ul>
      );
    }
    if (block.type === "hr") {
      return <hr key={i} className="my-3 h-px border-0 bg-[#E5E7EB]" />;
    }
    return (
      <p key={i} className="mb-2 text-[13px] font-medium leading-[19px] text-[#6B7280]">
        {renderInline(block.text)}
      </p>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAF9] pb-24 font-sans lg:pb-16">
      {/* ── Green header (TermsOfService title + last-updated) ── */}
      <header className="relative overflow-hidden rounded-b-[32px] bg-[#009849] px-5 pb-4 pt-5">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <span className="absolute -right-10 -top-16 h-[90%] w-[70%] rotate-[25deg] rounded-[120px] bg-[#00B857] opacity-25" />
          <span className="absolute -right-5 -top-20 h-[70%] w-[50%] rotate-[35deg] rounded-[100px] bg-white/10" />
        </div>
        <div className="relative z-10 mx-auto flex w-full max-w-3xl items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Go back"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#111827] shadow-[0_2px_8px_rgba(0,0,0,0.18)] transition-colors hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            <ArrowLeft size={22} />
          </button>
          <div className="min-w-0">
            <h1 className="text-[20px] font-black leading-tight text-white">Terms of Service</h1>
            <p className="mt-0.5 text-[13px] font-medium text-white/70">
              Last updated: 9 September 2026
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-5 pb-10 pt-5">
        <div className="space-y-4">
          <VayyCard>{preamble.map((block, i) => renderBlock(block, i))}</VayyCard>

          {sections.map((section) => (
            <VayyCard key={section.title}>
              <h2 className="mb-3 text-[16px] font-bold text-[#111827]">{section.title}</h2>
              {section.blocks.map((block, i) => renderBlock(block, i))}
            </VayyCard>
          ))}
        </div>
      </main>
    </div>
  );
}
