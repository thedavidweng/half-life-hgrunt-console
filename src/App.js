import React from "react";
import { WithContext as ReactTags } from "react-tag-input";
import hgrunt from "./hgrunt";
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

function isSpecialWord(word) {
  return word.includes("_");
}

function handleFilterSuggestions(query, suggestions) {
  const lowerQuery = query.toLowerCase();

  const normal = suggestions.filter(
    (item) => !isSpecialWord(item.id) && item.id.toLowerCase().includes(lowerQuery)
  );
  const special = suggestions.filter(
    (item) => isSpecialWord(item.id) && item.id.toLowerCase().includes(lowerQuery)
  );

  const result = [...normal];
  if (special.length > 0) {
    result.push({ id: "---", isDivider: true });
    result.push(...special);
  }

  return result;
}

function renderSuggestion(item, query) {
  if (item.isDivider) {
    return <div className="suggestion-divider" />;
  }

  const labelValue = item.id;
  if (!query || !query.trim()) {
    return <span>{labelValue}</span>;
  }

  const escapedRegex = query
    .trim()
    .replace(/[-\\\\^$*+?.()|[\]{}]/g, "\\$&");
  const html = labelValue.replace(new RegExp(escapedRegex, "gi"), (x) => {
    const escaped = x
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
    return `<mark>${escaped}</mark>`;
  });

  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

export default class App extends React.Component {
  state = {
    history: [],
    tags: urlState.get().map((word) => ({
      id: word.toLowerCase(),
    })),
    suggestions: hgrunt.words.map((word) => ({ id: word })),
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
    if (tag.id === "---") return;

    const word = tag.id.toLowerCase();

    if (!hgrunt.words.includes(word)) {
      return;
    }
    hgrunt.playWord(word);

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
    this.setState({ tags: nextTags }, () => {
      syncUrlState(this.state.tags);
    });
  };

  componentDidMount() {
    this.input = document.querySelector("input.ReactTags__tagInputField");
  }

  render() {
    const { tags, suggestions, history } = this.state;
    return (
      <>
        <div className="title">
          <span>HECU Grunt Console</span>
          <a
            href="https://github.com/suchipi/half-life-hgrunt-console"
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
            <a
              className="history-item"
              key={index}
              onClick={() => {
                const sentenceArray = sentence.toLowerCase().split(" ");
                hgrunt.playSentence(sentenceArray);
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
            placeholder={tags.length === 0 ? "Make the Grunt speak..." : ""}
            labelField="id"
            minQueryLength={0}
            allowUnique={false}
            tags={tags}
            suggestions={suggestions}
            handleDelete={this.handleDelete}
            handleAddition={this.handleAddition}
            handleDrag={this.handleDrag}
            delimiters={delimiters}
            handleFilterSuggestions={handleFilterSuggestions}
            renderSuggestion={renderSuggestion}
          />
        </div>
        <button
          className="play-sentence"
          onClick={() => {
            const sentence = tags.map((tag) => tag.id);
            hgrunt.playSentence(sentence);
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
      </>
    );
  }
}
