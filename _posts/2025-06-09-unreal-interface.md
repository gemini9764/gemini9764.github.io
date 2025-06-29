---
title: 언리얼 C++ 인터페이스
description: 인터페이스
author: gemini
date: 2025-06-08 21:00:00 +09:00
categories: [Unreal, part1]
tags: [interface]
math: true
mermaid: true
---

**인터페이스**

- **인터페이스란**
	- 객체가 반드시 구현해야 할 행동을 지정하는데 활용되는 타입
	- **다형성(Polymorphism)의 구현**, **의존성이 분리(Decouple)**된 설계에 유용하게 활용

- 언리얼엔진에서 게임 콘텐츠를 구성하는 오브젝트의 설계 예시
	- 월드에 배치되는 모든 오브젝트. 안 움직이는 오브젝트를 포함 *(Actor)*
	- 움직이는 오브젝트 *(Pawn)*
	- 길찾기 시스템을 반드시 사용하면서 움직이는 오브젝트 *(INavAgentInterface 인터페이스를 구현한 Pawn)*

---------------------------------------------------------

**언리얼 C++ 인터페이스 특징**
- 인터페이스를 생성하면 두 개의 클래스가 생성됨
	- U로 시작하는 타입 클래스(클래스 타입 정보)
	- I로 시작하는 인터페이스 클래스(실질적인 설계 및 구현)

- 객체를 설계할 때 I 인터페이스 클래스를 사용
	- U타입 클래스 정보는 런타임에 인터페이스 구현 여부를 파악하는 용도로 사용됨
	- 실제로 U타입 클래스에서 작업할 일은 없음
	- 인터페이스에 관련된 구성 및 구현은 I 인터페이스 클래스에서 진행

- C++ 인터페이스 특징
	- 추상 타입으로만 선언할 수 있는 Java, C#과 달리 언리얼은 인터페이스에도 구현이 가능함
	- 인터페이스에 구현을 하면 더 이상 추상 클래스가 아니게 되므로 상속 받은 자식 클래스들이 반드시 오버라이드해서 구현하지 않아도 된다.
	- 이 경우가 기존의 모던 객체지향에서 추구하는 바와 다르지만 이 내용을 종종 사용하는 경우가 있다.

---------------------------------------------------------

**정리**
- 클래스가 반드시 구현해야 하는 기능을 지정하는데 사용함
- C++은 기본적으로 다중상속을 지원하지만, 언리얼 C++의 인터페이스를사용해 가급적 축소된 다중 상속의 형태로 구현하는 것이 향후 유지보수도 도움된다.
- 언리얼 C++ 인터페이스는 두 개의 클래스를 생성한다.
- 언리얼 C++ 인터페이스는 추상 타입으로 강제되지 않고, 내부에 기본 함수를 구현할 수 있다.

>언리얼 C++ 인터페이스를 사용하면, 클래스가 수행해야 할 의무를 명시적으로 지정할 수 있어 좋은 객체 설계를 만드는 데 도움을 줄 수 있다.
{: .prompt-tip}