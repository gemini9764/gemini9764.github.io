---
title: 언리얼 모듈
description: 모듈
author: gemini
date: 2025-06-08 21:00:00 +09:00
categories: [Unreal, part1]
tags: [module]
math: true
mermaid: true
---

**모듈 간의 종속 관계**
- 모듈 사이에 종속 관계를 설정해 다양한 기능을 구현할 수 있다
- 우리가 만드는 게임 모듈도 언리얼 엔진이 마든 모듈을 활용해야 한다
- 언리얼 엔진이 제공하는 모듈 사이에도 종속 관계가 있음
- ![모듈 간의 종속 관계.png](/assets/img/posts/file_photos/모듈%20간의%20종속%20관계.png)

---------------------------------------------------------

**새로운 모듈의 추가**
- 하나의 모듈에 너무 많은 코드가 들어가면 언리얼 엔진은 빌드 방식을 변경함
- 그렇기에 프로젝트가 커질수록 모듈을 나누어서 관리하는 것이 유리
- ![새로운 모듈의 추가.png](/assets/img/posts/file_photos/새로운%20모듈의%20추가.png)

---------------------------------------------------------

**모듈의 공개와 참조**
- 모듈 내 소스를 필요한 만큼만 공개해야 모듈 간 의존성을 줄이고 컴파일 타임을 최소화 할 수 있음
- 공개할 파일은 모두 Public 폴더로

	>예외) 예전 언리얼 엔진은 Classes 폴더가 있어 Public 폴더 역할을 하면서 언리얼 오브젝트를 관리했음
	{: .prompt-info}

- 숨길 파일은 모두 Private 폴더로
- 외부로 공개할 클래스 선언에는 {모듈이름}(언더바)DLL 매크로를 붙일 것
- 게임 모듈에서는 Build.cs 설정을 통해 참조할 모듈을 지정할 수 있음
- ![모듈의 공개와 참조.png](/assets/img/posts/file_photos/모듈의%20공개와%20참조.png)

---------------------------------------------------------