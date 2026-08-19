---
title: FString
description: FString 클래스
author: gemini
date: 2025-06-08 21:00:00 +09:00
categories: [Unreal, part1]
tags: [FString]
math: true
mermaid: true
---

**FString의 구조와 활용**
- 다른 타입에서 FString으로의 변환
	- FString::Printf
	- FString::SanitizeFloat
	- FString::FromInt
- C런타임 수전에서 문자열을 처리하는 클래스 FCString
	- 예) 문자열을 찾는 strstr을 사용
- FString에서 다른 타입으로의 변환(안전하진 않음)
	- FCString::Atoi
	- FCString::Atof
- ![FString 구조.png](/assets/img/posts/file_photos/FString%20구조.png)

[FString 클래스](https://bit.ly/uefstringkr)
[FName 클래스 포스트](https://gemini9764.github.io/posts/unreal-FName/)