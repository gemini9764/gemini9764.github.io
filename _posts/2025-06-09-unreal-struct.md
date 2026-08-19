---
title: 언리얼 구조체
description: 구조체
author: gemini
date: 2025-06-08 21:00:00 +09:00
categories: [Unreal, part1]
tags: [UStruct]
math: true
mermaid: true
---

**언리얼 구조체 UStruct**
- 데이터 저장/전송에 특화된 가벼운 객체
- 대부분 GENERATED_BODY 매크로를 선언해준다
	- 리플렉션, 직렬화와 같은 유용한 기능을 지원함
	- GENERATED_BODY를 선언한 구조체는 UScriptStruct 클래스로 구현됨
	- 이 경우 제한적으로 리플렉션을 지원함
		- 속성 UPROPERTY만 선언할 수 있고 함수 UFUNCTION은 선언할 수 없음

- 언리얼 엔진의 구조체 이름은 F로 시작함
	- 대부분 힙 메모리 할당(포인터 연산) 없이 스택 내 데이터로 사용됨
	- NewObject API를 사용할 수 없음
- ![언리얼 리플렉션 관련 계층 구조.png](/assets/img/posts/file_photos/언리얼%20리플렉션%20관련%20계층%20구조.png)

[TMap 포스트](https://gemini9764.github.io/posts/unreal-TMap/)