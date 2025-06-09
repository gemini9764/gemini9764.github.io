---
title: TSet
description: TSet
author: gemini
date: 2025-06-08 21:00:00 +09:00
categories: [Unreal, part1]
tags: [TSet, container]
math: true
mermaid: true
---

- STL의 set과 언리얼 TSet의 비교
	- STL set의 특징
		- STL set은 이진 트리로 구성되어 있어 정렬을 지원함
		- STL set은 메모리 구성이 효율적이지 않음
		- STL set은 요소가 삭제될 때 균형을 위한 재구축이 일어날 수 있음
		- STL set의 모든 자료를 순회하는데 적합하지 않음

	- 언리얼 TSet 특징
		- TSet은 해시테이블 형태로 키 데이터가 구축되어 있어 빠른 검색이 가능함
		- TSet은 동적 배열의 형태로 데이터가 모여있음
		- TSet의 데이터는 빠르게 순회할 수 있음
		- TSet의 데이터는 삭제해도 재구축이 일어나지 않음
		- TSet의 재료에는 비어있는 데이터가 있을 수 있음

	- 따라서 STL set과 언리얼 TSet의 활용 방법은 서로 다르기 때문에 주의할 것
	- STL의 unordered_set과 유사하게 동작하지만 동일하진 않음
	- TSet은 중복 없는 데이터 집합을 구축하는데 유용하게 사용할 수 있음

- ![TSet의 내부 구조.png](/assets/img/posts/file_photos/TSet의%20내부%20구조.png)

[TSet](https://bit.ly/uetsetkr)


