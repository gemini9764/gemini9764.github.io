---
title: TMap
description: TMap
author: gemini
date: YYYY-MM-DD HH:MM:SS +09:00
categories: [Unreal, part1]
tags: [TMap, container]
math: true
mermaid: true
---

- STL map과 TMap의 비교
	- STL map의 특징
		- STL map은 STL set과 동일하게 이진 트리로 구성되어 있음
		- 정렬은 지원하지만, 메모리 구성이 효율적이지 않으며, 데이터 삭제시 재구축이 일어날 수 있음
		- 모든 자료를 순회하는데 적합하지 않음
	- 언리얼 TMap의 특징
	- 키, 밸류 구성의 튜플(Tuple) 데이터의 TSet 구조로 구현되어 있음
	- 해시테이블 형태로 데이터가 모여있음
	- 동적 배열의 형태로 데이터가 모여있음
	- 데이터는 빠르게 순회할 수 있음
	- 데이터는 삭제해도 재구축이 일어나지 않음
	- 비어있는 데이터가 있을 수 있음
	- TMultiMap을 사용하면 중복 데이터를 관리할 수 있음

- 동작 원리은 STL unordered_map과 유사함
- 키, 밸류 쌍이 필요한 자료구조에 광범위하게 사용됨
- ![TMap의 내부구조.png](/assets/img/posts/file_photos/TMap의%20내부구조.png)

[TMap](https://bit.ly/uetmapkr)

