---
title: FName 클래스
description: FName 클래스
author: gemini
date: 2025-06-08 21:00:00 +09:00
categories: [Unreal, part1]
tags: [FName]
math: true
mermaid: true
---

**언리얼이 제공하는 다양한 문자열 처리**
- *FName* : 애셋 관리를 위해 사용되는 문자열 체계
	- 대소문자 구분 없음==(주의)==
	- 한번 선언되면 바꿀 수 없음
	- 가볍고 빠름
	- 문자를 표현하는 용도가 아닌 애셋 키를 지정하는 용도로 사용. 빌드 시 해시값으로 변환됨
	- 뭔가를 찾기위한 용도가 주. 문자열을 처리하기 위한 클래스가 아님

- *FText* : 다국어 지원을 위한 문자열 관리 체계
	- 일종의 키로 작용함
	- 별도의 문자열 테이블 정보가 추가로 요구됨
	- 게임 빌드 시 자동으로 다양한 국가별 언어로 변환

[FName 클래스](https://bit.ly/uefnamekr)

---------------------------------------------------------

**FName의 구조와 활용**
- 언리얼은 FName과 관련된 글로벌 Pool 자료구조를 가지고 있음
- FName과 글로벌 Pool
	- 문자열이 들어오면 해시 값을 추출해 키를 생성해 FName에서 보관
	- FName 값에 저장된 값을 사용해 전역 Pool에서 원하는 자료를 검색해 반환
	- 문자 정보는 대소문자를 구반하지 않고 저장함 (Ignore Case)
- FName의 형성
	- 생성자에 문자열 정보를 넣으면 풀을 조사해 적당한 키로 변환하는 작업이 수반됨
	- Find or Add
- ![FName의 구조.png](/assets/img/posts/file_photos/FName의 구조.png)