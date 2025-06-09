---
title: 레퍼런스
description: C++ 레퍼런스에 대한 내용 정리
author: gemini
date: YYYY-MM-DD HH:MM:SS +09:00
categories: [C++]
tags: [레퍼런스]
math: true
mermaid: true
---

- 특정 변수에 대한 별명을 부여하는 것

> 자료형& 변수명
{: .prompt-tip}

```
#include <iostream>
    using namespace std;
    
    // 레퍼런스를 활용하여 변수에 별명을 부여하는 예제
    int main() {
        int var = 10;
        int& ref = var; // var의 레퍼런스 선언
    
        cout << "초기 값:" << endl;
        cout << "var: " << var << endl; // 10
        cout << "ref: " << ref << endl; // 10
    
        ref = 20; // ref를 변경하면 var도 변경됨
    
        cout << "ref 값을 변경한 후:" << endl;
        cout << "var: " << var << endl; // 20
        cout << "ref: " << ref << endl; // 20
    
        return 0;
    }
    
    /*
    출력 결과:
    초기 값:
    var: 10
    ref: 10
    ref 값을 변경한 후:
    var: 20
    ref: 20
    */
```

- 상수 레퍼런스
    - 레퍼런스에 상수 제약을 걸어서 읽기 전용으로 사용 가능
    - 상수 레퍼런스를 사요하면 값을 복사하지 않고도 기존 변수를 보호할 수 있다

> 예를 들어, const int& cref = x; 하면 복사 과정 없이 x의 값을 읽을 수는 있지만 x값을 수정할 수는 없다
{: .prompt-warning}

#### 포인터 vs 레퍼런스
- 선언과 초기화 시점이 다르다
    - 포인터는 선언 후, 나중에 가리킬 대상을 변경할 수 있다
    - 반면에 레퍼런스는 선언과 동시에 초기화해야한다
    - 초기화 이후에는 다른 대상에 재연결 불가능

- 레퍼런스는 항상 다른 변수와 연결되어 있기 때문에 NULL이라는 게 없다
    - 포인터는 유효한 대상이 없을 나타내기 위해 NULL 혹은 nullptr을 가질 수 있다

- 간접 참조 문법의 유무
    - 포인터는 주소값을 담으므로 접근할 때는 * 연산을 사용하고 주소를 가져올 때는 & 연산을 사용한다
     - 레퍼런스는 변수 자체의 별명이므로 일반 변수와 연산하는 방법이 동일