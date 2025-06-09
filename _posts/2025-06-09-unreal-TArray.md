---
title: TArray
description: TArray
author: gemini
date: YYYY-MM-DD HH:MM:SS +09:00
categories: [Unreal, part1]
tags: [TArray, container]
math: true
mermaid: true
---

- TArray는 가변 배열(Dynamic Array) 자료구조
- STL의 vector와 동작 원리가 유사함
- 게임 제작에서는 가변 배열 자료구조를 효과적으로 활용하는 것이 좋음
	- 데이터가 순차적으로 모여있기 때문에 메모리를 효과적으로 사용할 수 있고 캐시 효율이 높다
	- 컴퓨터 사용이 좋아지면서, 캐시 지역성(Locality)으로 인한 성능 향상은 굉장히 중요해짐
	- 임의 데이터의 접근이 빠르고, 고속으로 요소를 순회하는 것이 가능
- 가변 배열의 단점
	- 맨 끝에 데이터를 추가하는 것은 가볍지만, 중간에 요소를 추가하거나 삭제하는 작업은 비용이 큼
- 데이터가 많아질 수록 검색, 삭제, 수정 작업이 느려지기 때문에 많은 수의 데이터에서 검색 작업이 빈번하게 일어난다면 TArray 대신 TSet을 사용하는 것이 좋음
- ![TArray의 내부 구조.png](/assets/img/posts/file_photos/TArray의%20내부%20구조.png)

[TArray](https://bit.ly/uetarraykr)
