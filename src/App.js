import React from "react";
import { WithContext as ReactTags } from "react-tag-input";
import vox from "./vox";
import urlState from "./urlState";

const KeyCodes = {
  comma: 188,
  enter: 13,
  space: 32,
};

const delimiters = [KeyCodes.comma, KeyCodes.enter, KeyCodes.space];

function syncUrlState(tags) {
  urlState.set(tags.map((tag) => tag.id));
}

function toFileName(words) {
  const slug = words
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return "vox-" + (slug || "sentence") + ".wav";
}

export default class App extends React.Component {
  state = {
    history: [],
    tags: urlState.get().map((word) => ({
      id: word.toLowerCase(),
    })),
    suggestions: vox.words.map((word) => ({ id: word })),
    isDownloading: false,
  };

  handleDelete = (i) => {
    const { tags } = this.state;
    this.setState(
      {
        tags: tags.filter((tag, index) => index !== i),
      },
      () => {
        syncUrlState(this.state.tags);
      }
    );
  };

  handleAddition = (tag) => {
    const word = tag.id.toLowerCase();

    if (!vox.words.includes(word)) {
      return;
    }
    vox.playWord(word);

    this.setState(
      (state) => ({
        tags: [...state.tags, tag],
        history: [...state.history, word],
      }),
      () => {
        syncUrlState(this.state.tags);
        setTimeout(() => {
          this.input.focus();
          this.history.scrollTop = Number.MAX_SAFE_INTEGER;
        });
      }
    );
  };

  handleDrag = (tag, currPos, newPos) => {
    const nextTags = this.state.tags.slice();

    nextTags.splice(currPos, 1);
    nextTags.splice(newPos, 0, tag);

    // re-render
    this.setState({ tags: nextTags }, () => {
      syncUrlState(this.state.tags);
    });
  };

  handleDownload = async () => {
    const words = this.state.tags.map((tag) => tag.id);
    if (words.length === 0) return;

    this.setState({ isDownloading: true });
    try {
      const wav = await vox.getSentenceWav(words);
      if (wav == null) return;

      const url = URL.createObjectURL(wav);
      const link = document.createElement("a");
      link.href = url;
      link.download = toFileName(words);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      this.setState({ isDownloading: false });
    }
  };

  componentDidMount() {
    this.input = document.querySelector("input.ReactTags__tagInputField");
  }

  render() {
    const { tags, suggestions, history } = this.state;
    return (
      <>
        <div className="title">
          <span>VOX Console</span>
          <a
            href="https://github.com/suchipi/half-life-vox-console"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </div>
        <code
          className="history"
          ref={(el) => {
            this.history = el;
          }}
        >
          {history.map((sentence, index) => (
            /* eslint-disable-next-line jsx-a11y/anchor-is-valid */
            <a
              className="history-item"
              key={index}
              onClick={() => {
                const sentenceArray = sentence.toLowerCase().split(" ");
                vox.playSentence(sentenceArray);
                this.setState(
                  {
                    tags: sentenceArray.map((word) => ({ id: word })),
                  },
                  () => {
                    syncUrlState(this.state.tags);
                  }
                );
              }}
            >
              > {sentence}
            </a>
          ))}
        </code>
        <div className="tag-input-wrapper">
          <ReactTags
            placeholder={tags.length === 0 ? "Make the VOX speak..." : ""}
            labelField="id"
            minQueryLength={0}
            allowUnique={false}
            tags={tags}
            suggestions={suggestions}
            handleDelete={this.handleDelete}
            handleAddition={this.handleAddition}
            handleDrag={this.handleDrag}
            delimiters={delimiters}
          />
        </div>
        <button
          className="play-sentence"
          onClick={() => {
            const sentence = tags.map((tag) => tag.id);
            vox.playSentence(sentence);
            this.setState(
              {
                history: [...history, sentence.join(" ")],
              },
              () => {
                this.history.scrollTop = Number.MAX_SAFE_INTEGER;
              }
            );
          }}
        >
          Play
        </button>
        <button
          className="download"
          disabled={tags.length === 0 || this.state.isDownloading}
          onClick={this.handleDownload}
        >
          {this.state.isDownloading ? "Rendering…" : "Download"}
        </button>
      </>
    );
  }
}
