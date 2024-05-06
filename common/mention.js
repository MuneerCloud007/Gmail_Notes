var isMentionInput = function(node) {
    return node.parents("div.mentions-input").length > 0;
  };
  
  var getMentionCommentNode = function(text, aLinkBaseUrl, className) {
    var mentionText = SGNC.nl2br(SGNC.getMentionText(text, aLinkBaseUrl));
    var nodeClass = 'sgn_comment_content_detail';
    if (className) {
      nodeClass = className;
    }
    var commentNode = $("<div class='"+nodeClass+"'></div>");
    commentNode.html(mentionText);
    commentNode.find("a.sgn_team_member_link").click(function(e) {
      e.preventDefault();
      var link = $(this).attr("href");
      sendEventMessage(
      'SGN_PAGE_open_popup',
        {
          url: link,
          windowName: 'sgn-opportunity-popup',
          strWindowFeatures: SGNC.getStrWindowFeatures(1000, 700)
        }
      );
    });
    return commentNode;
  };
  
  var clearInputValue = function(node) {
    if (isMentionInput(node)) {
      node.mentionsInput('clear');
    } else {
      node.val('');
    }
  };
  
  var getInputValue = function(node) {
    if (isMentionInput(node)) {
      return node.mentionsInput('getValue');
    }
    return node.val();
  };
  
  var setInputValue = function(node, content) {
    if (isMentionInput(node)) {
      node.mentionsInput('clear');
      node.mentionsInput('setValue', content);
    } else {
      node.val(content);
    }
  };
  
  var initMention = function(node, source) {
    var backgroundColor = node.css("background-color");
    node.mentionsInput({
      source: source,
      autocomplete: {
        autoFocus: true,
        delay: 0,
        minLength: 0,
        close: function(event, ui) {
          var target = event.target;
          var ulMenu = $(target).siblings("ul.ui-menu");
          if (ulMenu.length > 0) {
            ulMenu.css({"top": 0, "left": 0});
          }
        },
        position: {
          using: function(e, i) {
            var element = i.element;
            var ulMention = element.element;
            var textarea = i.target.element[0];
            var caret = getCaretCoordinates(textarea, textarea.selectionEnd);
            var textareaPosition = $(textarea).offset();
            var top = textareaPosition.top + caret.top + 20 - $(window).scrollTop() - $(textarea).scrollTop();
            var left = textareaPosition.left + caret.left;
            if (!$(ulMention).position().top) {
              $(ulMention).css({"top": top, "left": left, "width": "177px"});
            }
          }
        }
      }
    });
  
    setInputBackgroundColor(node, backgroundColor);
    node.css("resize", "none");
  };
  
  var destoryMetionInput = function(node) {
    if (!isMentionInput(node)) {
      return;
    }
    var content = getInputValue(node);
    var backgroundColor = node.siblings("div.highlighter").css("background-color");
    node.mentionsInput('destroy');
    setInputValue(node, content);
    node.css("background-color", backgroundColor);
    node.removeClass('input');
    // duplicate init textarea, need to remove this data for jquery mentions plugins
    node.removeData("mentionsInput");
    node.css("resize", "auto");
    node.css("width", "100%");
  };
  
  var setInputBackgroundColor = function(node, color) {
    if (!isMentionInput(node)) {
      node.css('background-color', color);
      return;
    }
  
    node.css('background-color', 'transparent');
    var mentionContainer = node.parents("div.mentions-input");
    if (mentionContainer.length > 0) {
      var divMentionHighlighterDom = mentionContainer.find("div.highlighter");
      divMentionHighlighterDom.css('background-color', color);
    }
    return;
  };
  
  var setInputFontColor = function(node, color) {
    if (!isMentionInput(node)) {
      node.css('color', color);
      return;
    }
  
    node.css('color', 'transparent');
    var mentionContainer = node.parents("div.mentions-input");
    if (mentionContainer.length > 0) {
      var divMentionHighlighterDom = mentionContainer.find("div.highlighter");
      divMentionHighlighterDom.css('color', color);
      node.css('caret-color', '#000');
    }
    return;
  };
  
  var resizeMentionContainer = function(node) {
    if (!isMentionInput(node)) {
      return;
    }
  
    var previousWidth = node.data("previousWidth");
    var previousHeight = node.data("previousHeight");
  
    var nowWidth = node.width();
    var nowHeight = node.height();
  
    if (previousWidth === nowWidth && previousHeight === nowHeight) {
      return;
    }
  
    var mentionInputDiv = node.parents("div.mentions-input");
    var mentionHighlighter = mentionInputDiv.find("div.highlighter");
    mentionHighlighter.css("width", "auto");
    mentionHighlighter.height(nowHeight);
    node.data("previousWidth", nowWidth);
    node.data("previousHeight", nowHeight);
  };
  