---
title: 언리얼 컨테이너 라이브러리
description: 언리얼 컨테이너
author: gemini
date: YYYY-MM-DD HH:MM:SS +09:00
categories: [Unreal, part1]
tags: [container]
math: true
mermaid: true
---

**언리얼 컨테이너 라이브러리**
- 언리얼 엔진이 자체 제작해 제공하는 **자료구조 라이브러리**
- 줄여서 **UCL(Unreal Container Library)**라고도 함
- 언리얼 오브젝트를 안정적으로 지원하며 다수 오브젝트 처리에 유용하게 사용됨
- 언리얼 C++은 다양한 자료구조 라이브러리를 직접 만들어 제공하고 있음
- 실제 게임 제작에 유용하게 사용되는 라이브러리로 세 가지를 추천함

---------------------------------------------------------

**C++ STL과 언리얼 컨테이너 라이브러리의 차이점**

| C++ STL | 언리얼 컨테이너 라이브러리 |
| --- | ---- |
| 범용적으로 설계되어 있다 | 언리얼 엔진에 특화되어 있음 |
| 표준이기 때문에 호환성이 높다 | 언리얼 오브젝트 구조를 안정적으로 지원한다 |
| 많은 기능이 엮여 있어 컴파일 시간이 오래걸림 | 가볍고 게임 제작에 최적화되어 있음 |

---------------------------------------------------------

**언리얼 C++ 주요 컨테이너 라이브러리**
- 두 라이브러리의 이름과 용도는 유사하지만, 내부적으로 다르게 구현되어 있음

	>**TArray**<br>
	>오브젝트를 순서대로 담아 효율적으로 관리하는 용도로 사용(vector와 유사)
	{: .prompt-tip}

	>**TSet**
	>중복되지 않은 요소로 구성된 집합을 만드는 용도로 사용(set과 유사하지만 구조가 다름)
	{: .prompt-tip}
	
	>**TMap**
	>키, 밸류 조합의 레코드 관리를 용도로 사용(map과 유사하지만 구조가 다름)
	{: .prompt-tip}

- ![TArray와 TSet 시간 복잡도 비교.png](/assets/img/posts/file_photos/TArray와%20TSet%20시간%20복잡도%20비교.png)

[TArray 포스트](https://gemini9764.github.io/posts/unreal-TArray/)
[TSet 포스트](https://gemini9764.github.io/posts/unreal-TSet/)