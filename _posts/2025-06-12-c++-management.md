---
title: 자원 관리
description: C++ 자원관리에 대한 내용 정리
author: gemini
date: 2025-06-12 5:00:00 +09:00
categories: [C++]
tags: [resource_management]
math: true
mermaid: true
---

#### 스택 메모리

- 대부분의 일반 변수들이 차지하게 되는 공간
- 변수의 생존 주기가 끝나면 선언 시 할당되었던 메모리가 자동으로 회수된다
- 변수의 생존 주기는 선언된 라인을 기준으로 가장 가까운 마침 괄호 "`}`"
- 일반적으로 할당 가능한 스택 메모리의 크기가 제한적
- 변수의 스코프(생존 영역)을 벗어나며 자동으로 해제되므로 메모리를 더 길거나 유연하게 관리하기 어렵다

#### 힙 메모리

- 동적 할당 시 `new` 연산자를 사용하고, 해제 시 `delete` 연산자를 사용
- 스택과 달리 자동으로 해제되지 않으므로 메모리 누수 등의 위험이 있을 수 있다
- 동적 할당된 객체(또는 변수)의 생존 주기는 사용자가 `delete`로 해제할 대까지 유지

- **Dangling Pointer**
    - 메모리 할당된 변수가 해제되었는데, 해제된 메모리 공간에 접근하려고 했을 때의 현상
    - Dangling Pointer 예시

```
#include <iostream>
using namespace std;
    
void func5() {
    int* ptr = new int(40);  // 힙 메모리에 정수 40 할당
    int* ptr2 = ptr;
    
    cout << "ptr adress = " << ptr << endl;
    cout << "ptr2 adress = " << ptr2 << endl;
    cout << *ptr << endl;
    
    delete ptr;
    
    cout << *ptr2 << endl;
}
    
int main() {
    func5();
    return 0;
}
```

- **Memory Leak(메모리 누수)**
    - 동적 할당된 메모리를 제대로 해제하지 않고 계속해서 할당을 추가했을 때의 현상


#### 스마트 포인터

- **unique_ptr**
    - 객체에 대한 단일 소유권을 관리
    - 객체의 소유권을 명확히 하고 소유권 이전을 통해 효율적인 자원관리가 가능
    - `move`를 통해 소유권을 이동하는 식으로 관리
    - 두 개의 포인터가 동시에 하나의 메모리 공간을 소유할 순 없다
    - 소유권의 개념만 있기 때문에 `복사` 혹은 `대입`이 불가능

```
#include <iostream>
#include <memory>
using namespace std;
    
class MyClass {
public:
    MyClass(int val) : value(val) {
        cout << "MyClass 생성: " << value << endl;
    }
    ~MyClass() {
        cout << "MyClass 소멸: " << value << endl;
    }
    void display() const {
        cout << "값: " << value << endl;
    }
private:
    int value;
};
    
int main() {
    // unique_ptr로 MyClass 객체 관리
    unique_ptr<MyClass> myObject = make_unique<MyClass>(42);
    
    // MyClass 멤버 함수 호출
    myObject->display();
    
    // 소유권 이동
    unique_ptr<MyClass> newOwner = move(myObject);
    
    if (!myObject) {
        cout << "myObject는 이제 비어 있습니다." << endl;
    }
    newOwner->display();
    
    // 범위를 벗어나면 newOwner가 관리하는 메모리 자동 해제
    return 0;
}
```


- **shared_ptr**
    - 레퍼런스 카운트를 관리
    - 레퍼런스 카운트란 현재 객체를 참조하는 포인터의 개수를 카운팅
    - 레퍼런스 카운트가 0이 되면 자동으로 메모리 해제
    - `Dangling Pointer` 및 `MemoryLeak` 문제를 효과적으로 방지 가능
    - `use_count()` 메소드를 활용하여 현재 객체를 참조하는 포인터의 수를 확인할 수 있다
    - `reset()` 메소드로 소유 중인 객체를 해제하거나 다른 객체로 변경할 수 있다


```
#include <iostream>
#include <memory>
using namespace std;
    
class MyClass {
public:
    MyClass(int val) : value(val) {
        cout << "MyClass 생성: " << value << endl; // 출력: MyClass 생성: 42
    }
    ~MyClass() {
        cout << "MyClass 소멸: " << value << endl; // 출력: MyClass 소멸: 42
    }
    void display() const {
        cout << "값: " << value << endl; // 출력: 값: 42
    }
private:
    int value;
};
    
int main() {
    // shared_ptr로 MyClass 객체 관리
    shared_ptr<MyClass> obj1 = make_shared<MyClass>(42);
    
    // 참조 공유
    shared_ptr<MyClass> obj2 = obj1;
    
    cout << "obj1과 obj2의 참조 카운트: " << obj1.use_count() << endl; // 출력: 2
    
    obj2->display(); // 출력: 값: 42
    
    // obj2를 해제해도 obj1이 객체를 유지
    obj2.reset();
    cout << "obj2 해제 후 obj1의 참조 카운트: " << obj1.use_count() << endl; // 출력: 1
    
    return 0;
}
```


- **week_ptr**
    - 객체의 소유권을 공유하지 않음
    - 다른 스마트 포인터와 다르게 레퍼런스 카운트를 증가시키지 않는 약한 참조
    - `shared_ptr`는 유용하지만 순환참조가 발생할 수 있다
    - 서로 순환하고 있는 `shared_ptr` 중 하나를 `weak_ptr`로 대체하면 순환 고리가 끊어지므로 문제를 해결할 수 있다
    - `ahred_ptr`은 관찰과 소유를 하는 반면, `wear_ptr`은 관찰만 한다
    - `lock()` 호출 후 반환된 `shared_ptr`이 유효한지 확인 후에 사용해야 한다

- 순환참조가 발생하는 예시

```
#include <iostream>
#include <memory>
using namespace std;
    
class MyClass {
public:
    MyClass(int val) : value(val) {
        cout << "MyClass 생성: " << value << endl; // 출력: MyClass 생성: 42
    }
    ~MyClass() {
        cout << "MyClass 소멸: " << value << endl; // 출력: MyClass 소멸: 42
    }
    void display() const {
        cout << "값: " << value << endl; // 출력: 값: 42
    }
private:
    int value;
};
    
int main() {
    // shared_ptr로 MyClass 객체 관리
    shared_ptr<MyClass> obj1 = make_shared<MyClass>(42);
    
    // 참조 공유
    shared_ptr<MyClass> obj2 = obj1;
    
    cout << "obj1과 obj2의 참조 카운트: " << obj1.use_count() << endl; // 출력: 2
    
    obj2->display(); // 출력: 값: 42
    
    // obj2를 해제해도 obj1이 객체를 유지
    obj2.reset();
    cout << "obj2 해제 후 obj1의 참조 카운트: " << obj1.use_count() << endl; // 출력: 1
    
    return 0;
}
```

>순환참조<br>
>두 개 이상의 객체가 서로를 shared_ptr로 가리켜 참조하는 상황<br>
>이러한 순환 참조는 메모리 누수를 유발할 수 있음
{: .prompt-info}

- `weak_ptr`로 순환참조를 해결하는 예시

```
#include <iostream>
#include <memory>
using namespace std;

class B; // Forward declaration

class A
{
public:
	shared_ptr<B> b_ptr;
	~A() { cout << "A destroyed" << endl; }
};

class B
{
public:
	weak_ptr<A> a_ptr;	// weak_ptr로 변경
	~B() { cout << "B destroyed" << endl; }
};

int main()
{
	auto a = make_shared<A>();
	auto b = make_shared<B>();

	a->b_ptr = b;
	b->a_ptr = a;	// weak_ptr로 참조

	return 0;
}
```


#### 얕은 복사와 깊은 복사

- **얕은 복사**
    - 클래스 내의 포인터 멤버를 복사할 때, 포인터가 가리키는 데이터가 아닌 포인터가 저장하고 있는 주소값만 복사

![얕은 복사.png](/assets/img/posts/file_photos/얕은%20복사.png)

```
#include <iostream>
using namespace std;

int main() {
    // 포인터 A가 동적 메모리를 할당하고 값을 30으로 설정
    int* A = new int(30);

    // 포인터 B가 A가 가리키는 메모리를 공유
    int* B = A;

    cout << "A의 값: " << *A << endl; // 출력: 30
    cout << "B의 값: " << *B << endl; // 출력: 30

    // A가 동적 메모리를 해제
    delete A;

    // 이제 B는 Dangling Pointer(해제된 메모리를 가리키는 포인터)
    // 이 시점에서 B를 통해 접근하면 Undefined Behavior 발생
    cout << "B의 값 (dangling): " << *B << endl; // 위험: 정의되지 않은 동작

    return 0;
}
```

- **깊은 복사**
    - 클래스의 포인터 멤버가 기리키는 동적 데이터를 새로 할당된 독립적인 메모리 영역에 복제는 것을 의미
    - 원복 객체와 복사된 객체는 서로 독립적인 메모리 공간을 소유하므로 `dangling pointer`가 발생하지 않는다

![깊은 복사.png](/assets/img/posts/file_photos/깊은%20복사.png)

```
#include <iostream>
using namespace std;

int main() {
    // 포인터 A가 동적 메모리를 할당하고 값을 30으로 설정
    int* A = new int(30);

    // 포인터 B가 A가 가리키는 값을 복사 (깊은 복사)
    int* B = new int(*A);

    cout << "A의 값: " << *A << endl; // 출력: 30
    cout << "B의 값: " << *B << endl; // 출력: 30

    // A가 동적 메모리를 해제
    delete A;

    // B는 여전히 독립적으로 자신의 메모리를 관리
    cout << "B의 값 (깊은 복사 후): " << *B << endl; // 출력: 30

    // B의 메모리도 해제
    delete B;

    return 0;
}
```

>일반적으로 포인터나 동적으로 할당된 자원을 관리하는 객체는 메모리 안정성을 위해 **깊은 복사**를 사용하는 것이 바람직하다
{: .prompt-tip}


#### 언리얼 엔진의 메모리 관리

- 언리얼 엔진은 객체들의 메모리 관리를 자동화하기 위해 가비지 컬렉션 시스템을 사용
- 가비지 컬렉션은 더 이상 사용하지 않는 메모리를 알아서 치워주는 것
- 이를 통해 개발자가 메모리 해제를 수동으로 처리하는 부담을 덜고, 메모리 누수나 댕글링 포인터와 같은 메모리 오류를 줄일 수 있다

- **가비지 컬렉션**
    - **마크 앤 스윕 알고리즘 방식**으로 동작
        - 이 알고리즘은 주기적으로 실행되며, 더 이상 프로그램에서 사용하지 않는다고 판단되는 `UObject`들을 식별하여 메모리에서 제거
         - 총 3단계로 진행
        1. 루트셋에서 시작
            - 먼저 루트셋에 포함된 객체들을 식별
            - 이 객체들은 항상 살아있다고 간주되는 특별한 객체
            - 예를 들어, 게임 엔진 자체, 플레이어 컨트롤러 등이 루트셋에 포함될 수 있다. 이는 가비지 컬렉션 대상이 아니다

        2. 마크 단계 - 도달 가능성 분석
            - 루트셋 객체에서 시작해서 직간접적으로 참조하는 `UObject`를 마크한다. 이는 객체가 사용중임을 나타냄

        3. 스윕 단계 - 메모리 회수
            - 마크 단계가 완료되면 마크되지 않은 객체들이 차지하고 있던 메모리를 회수한다. 이 과정에서 해당 객체의 소멸자가 호출되고 메모리가 반환

    - `UObject`에는 가비지 컬렉션 동작 방식을 제어하는 다양한 플래그가 존재
        - 이 플래그들은 가비지 컬렉션의 동작에 중요한 정보를 제공하며, `GUObjectArray`라는 전역 배열에 저장된 각 객체 정보의 일부로 관리
        - **RF_RootSet**
            - 이 플래그가 설정된 객체는 루트셋의 일부로 관리
            - 즉 설정된 시점부터 가비지 컬렉션 대상이 아니다. `AddToRoot()` 함수를 통해 설정하고, `RemoveFromRoot()` 함수를 통해 해제
        - **RF_BeginDestroyed**
            - 객체의 `BeginDestroy()` 함수가 호출되었음을 나타냄
            - 해당 함수는 객체가 실제로 메모리에서 해제되기 전에 필요한 정리 작업을 수행하는 함수
        - **RF_FinishDestroyed**
            - 객체의 `FinishDestroy()` 함수가 호출되었음을 나타냄.
            - 해당 함수는 객체 소멸의 마지막 단계로, 이 함수 호출 후 객체의 메모리가 완전히 해제됨

![마크앤스윕알고리즘.png](/assets/img/posts/file_photos/마크앤스윕알고리즘.png)


#### 언리얼 엔진의 리플렉션 시스템

- **리플렉션**
    - 프로그램이 실행 중에 자신의 구조와 상태를 검사하고 수정할 수 있는 능력
    - `UObject`를 위한 운영체제와 같다
    - 언리얼 엔진 내부에서 동작하는 여러 모듈(가비지 컬렉터, 스트립트 시스템) 등은 모두 `UObject` 기반
    - 하지만 사용자가 정의한 타입들이 경우 엔진에서 알지 못하므로, 이를 처리할 수 있도록 타입 정보를 공유해야 한다. 이를 위한 작업이 리플렉션
    - 리플렉션의 핵심은 **UHT(언리얼 엔진 툴) 코드 생성기**
        - C++ 컴파일러가 수행되기 전에 동작
        - C++ 코드 내에서 메타 데이터를 얻고, 내부적으로 소스코드를 생성. 이 동작이 완료된 후, C++ 컴파일러가 수행된다

- 언리얼 엔진에서 핵심 리플렉션 매크로

| 매크로              | 리플렉션에서의 목적                          | 일반적인 위치        |
| ---------------- | ----------------------------------- | -------------- |
| UCLASS()         | C++ 클래스를 UObject 기반의 리플렉션 시스템에 등록   | 클래스 정의 앞       |
| UPROPERTY()      | 멤버 변수를 리플렉션 시스템에 노출                 | 멤버 변수 선언 앞     |
| UFUNTION()       | 멤버 변수를 리플렉션 시스템에 노출                 | 멤버 변수 선언 앞     |
| USTRUCT()        | C++ 구조체를 리플렉션 시스템에 등록               | 구조체 정의 앞       |
| GENERATED_BODY() | UHT가 생성하는 리플렉션 및 엔진 지원 코드를 위한 삽입 지정 | 클래스/구조체 본문 첫 줄 |

![리플렉션.png](/assets/img/posts/file_photos/리플렉션.png)