import React from "react";
import { WithContext as ReactTags } from "react-tag-input";
import hgrunt from "./hgrunt";
import urlState from "./urlState";

const KeyCodes = {
  comma: 188,
  enter: 13,
  space: 32,
  backspace: 8,
  delete: 46,
  escape: 27,
};

const delimiters = [KeyCodes.comma, KeyCodes.enter, KeyCodes.space];

const SELECTED_TAG_CLASS = "ReactTags__tag--selected";
const DRAGGING_TAG_CLASS = "ReactTags__tag--dragging";

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
    selectedIndex: null,
    dragIndex: null,
  };

  handleDelete = (i) => {
    const { tags } = this.state;
    this.setState(
      {
        tags: tags.filter((tag, index) => index !== i),
        selectedIndex: null,
      },
      () => {
        syncUrlState(this.state.tags);
        if (this.input) {
          this.input.focus();
        }
      }
    );
  };

  handleTagClick = (i) => {
    this.setState((state) => ({
      selectedIndex: state.selectedIndex === i ? null : i,
    }));
  };

  // Runs in the capture phase so that Backspace/Delete on a selected word is
  // handled here instead of by ReactTags, which always drops the last tag.
  handleTagInputKeyDown = (event) => {
    const { selectedIndex } = this.state;

    if (selectedIndex === null) return;

    if (event.keyCode === KeyCodes.escape) {
      this.setState({ selectedIndex: null });
      return;
    }

    const isDeleteKey =
      event.keyCode === KeyCodes.backspace || event.keyCode === KeyCodes.delete;
    if (!isDeleteKey) return;

    // Let the browser edit whatever is already typed in.
    if (this.input && this.input.value !== "") return;

    event.preventDefault();
    event.stopPropagation();
    this.handleDelete(selectedIndex);
  };

  handleTagInputRef = (el) => {
    this.tagInputWrapper = el;
    if (el) {
      el.addEventListener("keydown", this.handleTagInputKeyDown, true);
    }
  };

  /*
    react-tag-input keys each tag as `id + '-' + index`, so reordering unmounts
    and remounts every tag. That throws away react-dnd's `isDragging` state, so
    the library's own opacity: 0 hint disappears as soon as the word moves.
    We track the dragged word's index ourselves instead.
  */
  handleDragStart = (event) => {
    const tagEl = event.target.closest && event.target.closest(".ReactTags__tag");
    if (!tagEl || !this.tagInputWrapper) return;

    const tagEls = Array.prototype.slice.call(
      this.tagInputWrapper.querySelectorAll(".ReactTags__tag")
    );
    const index = tagEls.indexOf(tagEl);
    if (index === -1) return;

    this.setState({ dragIndex: index });
  };

  // Listen on document: the source node is removed mid-drag, so dragend may
  // never bubble through the tag wrapper.
  handleDragEnd = () => {
    if (this.state.dragIndex !== null) {
      this.setState({ dragIndex: null });
    }
  };

  // A selected word is an editing-mode concept; once the user starts typing a
  // new word, clear the selection so suggestions and Backspace behave normally.
  handleInputChange = (value) => {
    if (this.state.selectedIndex !== null && value && value.trim() !== "") {
      this.setState({ selectedIndex: null });
    }
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
        selectedIndex: null,
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
    const [movedTag] = nextTags.splice(currPos, 1);
    nextTags.splice(newPos, 0, movedTag);
    // The dragged word now sits at newPos, so the placeholder follows it.
    this.setState(
      { tags: nextTags, selectedIndex: null, dragIndex: newPos },
      () => {
        syncUrlState(this.state.tags);
      }
    );
  };

  componentDidMount() {
    this.input = document.querySelector("input.ReactTags__tagInputField");
    document.addEventListener("dragstart", this.handleDragStart);
    document.addEventListener("dragend", this.handleDragEnd);
    document.addEventListener("drop", this.handleDragEnd);
  }

  componentWillUnmount() {
    document.removeEventListener("dragstart", this.handleDragStart);
    document.removeEventListener("dragend", this.handleDragEnd);
    document.removeEventListener("drop", this.handleDragEnd);
  }

  render() {
    const { tags, suggestions, history, selectedIndex, dragIndex } = this.state;

    // A dragged word is styled as an insertion placeholder; otherwise a
    // selected word is styled as pressed in. Dragging wins when both apply.
    const decoratedTags = tags.map((tag, index) => {
      if (index === dragIndex) {
        return { ...tag, className: DRAGGING_TAG_CLASS };
      }
      if (index === selectedIndex) {
        return { ...tag, className: SELECTED_TAG_CLASS };
      }
      return tag;
    });

    return (
      <>
        <div className="title">
          <span>HECU Grunt Console</span>
          <a
            href="https://github.com/thedavidweng/half-life-hgrunt-console"
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
                hgrunt.playSentence(sentenceArray);
                this.setState(
                  {
                    tags: sentenceArray.map((word) => ({ id: word })),
                    selectedIndex: null,
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
        <div className="tag-input-wrapper" ref={this.handleTagInputRef}>
          <ReactTags
            placeholder={tags.length === 0 ? "Make the Grunt speak..." : ""}
            labelField="id"
            minQueryLength={1}
            allowUnique={false}
            tags={decoratedTags}
            suggestions={suggestions}
            handleDelete={this.handleDelete}
            handleAddition={this.handleAddition}
            handleDrag={this.handleDrag}
            handleTagClick={this.handleTagClick}
            handleInputChange={this.handleInputChange}
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
