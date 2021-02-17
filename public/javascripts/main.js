$(function() {
    const FADE_TIME = 150; // ms
    const TYPING_TIMER_LENGTH = 400; //ms
    const COLORS = [
        '#e21400', '#91580f', '#f8a700', '#f78b00',
        '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
        '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
    ];

    // Initialize variables
    const $window = $(window);
    const $usernameInput = $('.usernameInput');
    const $message = $('.messages');
    const $inputMessage = $('.inputMessage');
    const $members = $('.members');
    const $userNum = $('.userNum');

    const $loginPage = $('.login.page');
    const $chatPage = $('.chat.page');

    const socket = io();

    // prompt for setting a username
    let username;
    let connected = false;
    let typing = false;
    let lastTypingTime;
    let $currentInput = $usernameInput.focus();

    // load the memberlist
    const loadMemberList = (data) => {
        $('.member').fadeOut(function(){
            $(this).remove();
        });
        const userList = data.userList;
        for(var i=0; i<userList.length; i++){
            const $el = $('<li>').addClass('member').text(userList[i]);
            $members.append($el);
        }
    }

    // add username to member list
    const addMemberToList = (data) => {
        const username = data.username;
        const $el = $('<li>').addClass('member').text(username);
        $members.append($el);
    }

    // update count of members
    const updateOnlineMemCnt = (data) => {
        let message = 'ONLINE -- ' + data.numUsers;
        $userNum.text(message);
    }

    // sets the client's username
    const setUsername = () => {
        username = cleanInput($usernameInput.val().trim());

        // if the username is valid
        if (username) {
            $loginPage.fadeOut();
            $chatPage.show();
            $loginPage.off('click');
            $currentInput = $inputMessage.focus();

            // tell the server your name
            socket.emit('add user', username);
        }
    }

    // send a chat message
    const sendMessage = () => {
        let message = $inputMessage.val();
        // prevent markup from being injected into the message
        message = cleanInput(message);
        // if there is a non-empty message and socket connection
        if (message && connected) {
            $inputMessage.val('');
            addChatMessage({username, message});
            // tell server to execute 'new message' and send along one parameter
            socket.emit('new message', message);
        }
    }

    // log a message
    const log = (message, options) => {
        const $el = $('<li>').addClass('log').text(message);
        addMessageElement($el, options);
    }

    // adds the visual chat message to the message list
    const addChatMessage = (data, options) => {
        // Don't fade the message in if there is a 'X was typing'
        const $typingMessages = getTypingMessages(data);
        if ($typingMessages.length !== 0) {
            options = {
                fade : false
            }
            $typingMessages.remove();
        }

        // set username, message css
        const $usernameDiv = $('<span class="username"/>')
            .text(data.username)
            .css('color', getUsernameColor(data.username));
        const $messageBodyDiv = $('<span class="messageBody"/>')
            .text(data.message);

        const typingClass = data.typing ? 'typing' : '';
        const $messageDiv = $('<li class="message"/>')
            .data('username', data.username)
            .addClass(typingClass)
            .append($usernameDiv, $messageBodyDiv);

        addMessageElement($messageDiv, options);
    }

    // adds the visual chat typing message
    const addChatTyping = (data) => {
        data.typing = true;
        data.message = 'is typing';
        addChatMessage(data);
    }

    // removes the visual chat typing message
    const removeChatTyping = (data) => {
        getTypingMessages(data).fadeOut(function () {
            $(this).remove();
        });
    }

    // adds a message element to the message and scrolls to the bottom
    // el - The element to add as a message
    // options.fade - if the element should fade-in (default = true)
    // options.prepend - if the element should prepend
    // all other messages (dafault = false)
    const addMessageElement = (el, options) => {
        const $el = $(el);
        // setup default options
        if (!options) {
            options = {};
        }
        if (typeof options.fade === 'undefined') {
            options.fade = true;
        }
        if (typeof options.prepend === 'undefined') {
            options.prepend = false;
        }

        // apply options
        if (options.fade) {
            $el.hide().fadeIn(FADE_TIME);
        }
        if (options.prepend) {
            $message.prepend($el);
        } else {
            $message.append($el);
        }

        $message[0].scrollTop = $message[0].scrollHeight;
    }

    // prevents input from having injected markup
    const cleanInput = (input) => {
        return $('<div/>').text(input).html();
    }

    // Updates the typing event
    const updateTyping = () => {
        if (connected) {
            if (!typing) {
                typing = true;
                socket.emit('typing');
            }
            lastTypingTime = (new Date()).getTime();

            setTimeout(() => {
                const typingTimer = (new Date()).getTime();
                const timeDiff = typingTimer - lastTypingTime;
                if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
                    socket.emit('stop typing');
                    typing = false;
                }
            }, TYPING_TIMER_LENGTH);
        }
    }

    // gets the 'x is typing' message of a user
    const getTypingMessages = (data) => {
        return $('.message.typing').filter(function (i) {
            return $(this).data('username') === data.username;
        });
    }

    // gets the color of a username through our hash function
    const getUsernameColor = (username) => {
        // compute hash code
        let hash = 7;
        for (let i = 0; i < username.length; i++){
            hash = username.charCodeAt(i) + (hash << 5) - hash;
        }
        // calculate color
        const index = Math.abs(hash % COLORS.length);
        return COLORS[index];
    }


    // keyboard events

    $window.keydown(event => {
        // auto focus the current input when a key is typed
        if (!(event.ctrlKey || event.metaKey || event.altKey)) {
            $currentInput.focus();
        }
        // when the client hits ENTER on their keyboard
        if (event.which === 13) {
            if (username) {
              sendMessage();
              socket.emit('stop typing');
              typing = false;
            } else {
              setUsername();
            }
          }
    });

    $inputMessage.on('input', () => {
        updateTyping();
    });

    
    /* Click Events */

    // Focus input when clicking anywhere on login page
    $loginPage.click(() => {
        $currentInput.focus();
    });

    // Focus input when clicking on the message input's border
    $inputMessage.click(() => {
        $inputMessage.focus();
    });

    
    /* Socket Events */

    // Whenever the server emits 'login', log the login message
    socket.on('login', (data) => {
        connected = true;
        // Display the welcome message
        const message = 'Welcome to Socket.IO Chat';
        log(message, {
        prepend: true
        });
        updateOnlineMemCnt(data);
        loadMemberList(data);
    });

    // Whenever the server emits 'new message', update the chat body
    socket.on('new message', (data) => {
        addChatMessage(data);
    });

    // Whenever the server emits 'user joined', log it in the chat body
    socket.on('user joined', (data) => {
        log(`${data.username} joined`);
        updateOnlineMemCnt(data);
        addMemberToList(data);
    });

    // Whenever the server emits 'user left', log it in the chat body
    socket.on('user left', (data) => {
        log(`${data.username} left`);
        updateOnlineMemCnt(data);
        removeChatTyping(data);
        loadMemberList(data);
    });

    // Whenever the server emits 'typing', show the typing message
    socket.on('typing', (data) => {
        addChatTyping(data);
    });

    // Whenever the server emits 'stop typing', kill the typing message
    socket.on('stop typing', (data) => {
        removeChatTyping(data);
    });

    socket.on('disconnect', () => {
        log('you have been disconnected');
    });

    socket.on('reconnect', () => {
        log('you have been reconnected');
        if (username) {
        socket.emit('add user', username);
        }
    });

    socket.on('reconnect_error', () => {
        log('attempt to reconnect has failed');
    });

});