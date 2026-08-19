---
title: Dedicated Server
description: 서버의 종류와 Dedicated Server
author: gemini
date: 2025-09-08 19:00:00 +09:00
categories: [Unreal]
tags: [Dedicated_Server]
math: true
mermaid: true
---

- P2P Server (Peer to Peer Server)
	- 각각의 컴퓨터가 클라이언트이자 서버인 구조
	- 다크소울, 토렌트
- Listen Server
	- 클라이언트이자 서버인 방장(Host)이 있고, 나머지 참가자(Guest)는 모두 클라이언트 역할만 맡는 형태. P2P의 일종
	- 마인크래프트, 어몽어스
- Dedicated Server
	- 서버를 담당하는 컴퓨터가 따로 있다
	- 서버-클라이언트 구조
	- 배틀 그라운드
	- 흐름도
		- PIE를 했거나, Server.exe를 실행하는 식으로 서버 프로세스 실행 실행할 때 Open (Level 이름)?Listen 명령어가 인자로 전달된다.
		- 해당 Level을 열어둔다
		- 이때 Socket이 생성되며 다른 PC가 접속 가능하게끔 한다
		- Listen 명령어가 없다면 싱글플레이
		- Level에는 WorldSetting 속성이 있고, WrldSetting에는 GameMode와 GameState 정보가 있다
		- 이를 통해 GameMode와 GameState 액터를 생성한다
		- 중요한 것은 GameMode 액터는 전체 컴퓨터에서 딱 한 곳(Server)에만 존재한다
		- GameMode = Server로 생각해도 무방
		- 클라이언트는 서버의 IP 주소와 포트 번호로 접속 시도
		- 서버는 접속 시도하는 클라이언트에게 Level 정보를 넘긴다
		- 클라이언트도 해당 Level을 열고, Level을 여는데 성공했다고 Dedicated Server에 알린다
		- Level을 여는데 성공한 클라이언트 전용 PlayerController, PlayerCharacter가 서버에 생성된다
		- 이것이 다시 Client1에 복제된다. GameState도 복제되게 된다
		- 또 다른 Client도 접속
		- 마찬가지로 서버는 접속 시도하는 또 다른 클라이언트에게 Level 정보를 넘긴다
		- Client도 해당 Level을 열고, Level을 여는데 성공했다고 Dedicated Server에 알린다
		- Client2 전용 PlayerState, PlyaerControlle, PlayerCharacter가 서버에 생성된다
		- 이때, 클라이언트 간의 PlayerState와 PlayerCharacter도 복제되면서 서로 보이게 된다

![서버의 종류와 데이테이트 서버.png](/assets/img/posts/file_photos/서버의%20종류와%20데이테이트%20서버.png)

- 서버-클라이언트 구조의 아주 중요한 특징
	- 그림에서 볼 수 있듯, 클라이언트와 클라이언트 간의 통신이 불가능
	- 오직 서버와 클라이언트 사이의 통신만 가능
	- RPC나 프로퍼티 레플리케이션에도 영향을 끼치게 된다