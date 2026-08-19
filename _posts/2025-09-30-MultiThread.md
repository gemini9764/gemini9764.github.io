---
title: 멀티스레드
description: 최적화를 위한 멀티스레드 이해
author: gemini
date: 2025-09-30 19:00:00 +09:00
categories: [Unreal]
tags: [Thread]
math: true
mermaid: true
---

>언리얼 엔진과 멀티 스레드 구조를 이해하는 것이 중요한 이유<br>
>이 둘의 관계를 알면 성능 최적화의 핵심을 뚫어볼 수 있다. 히치(Hitch) 현상의 원인을 파악하고, 더 부드럽고 효율적인 게임을 만들 수 있는 기반 지식을 쌓게 된다
{: .prompt-tip}


#### 언리얼 엔진의 멀티스레드 구조

>**멀티스레딩이란?**<br>
>컴퓨터의 CPU는 여러 작업을 동시에 처리할 수 있는 능력을 가지고 있다<br>
>멀티스레딩은 이 능력을 활용하여 게임의 다양한 작업을 여러 **스레드**(**작업단위**)에 나누어 **병렬**로 처리하는 방식
{: .prompt-info}

- 언리얼 엔진의 목적
	- 게임 로직과 렌더링 작업을 분리하여 처리함으로써, 게임이 항상 부드러운 프레임을 유지 할 수 있도록 설계
	- 예를 들어, 무거운 물리 계산이 발생해도 화면이 멈추기 않고 계속 부드럽게 움직일 수 있도록 하는 것이 핵심

- 주요 스레드 구성
	- GameThread
	- RenderThread
	- RHIThread


##### GameThread, 게임의 모든 '논리'를 담당

- 게임 플레이와 관련된 모든 계산을 처리하는 메인 스레드

- 주요 역할
	- 게임 로직
		- 캐릭터의 움직임, AI 행동, UI 상호작용, 이벤트 처리 등 게임의 규칙과 흐름을 관리
	- 물리 시뮬레이션
		- 충돌 판정, 중력 계산 등 물리 엔진의 연산을 담당
	- 애니메이션 업데이트
		- 캐릭터 애니메이션 상태를 업데이트하고 블렌딩
	- 입력 처리
		- 키보드, 마우스, 컨트롤러 등 사용자 입력을 받아서 처리

- 작동 방식
	- **매 프레임마다 게임의 상태를 업데이트**. 이 과정을 `Tick`이라고 부른다
	- `Tick` 함수 안에서 모든 게임 로직이 순차적으로 실행된다
	- *만약 GameThread에서 무거운 연산이 발생하면, 다음 프레임으로 넘어가는 시간이 길어지고 프레임 드랍(Drop)이 발생한다*


##### RenderThread, 게임을 '그려내는' 전문가

- GameThread로부터 받은 데이터를 바탕으로 **RHIThread에게 전달할 렌더링 커맨드를 준비**하는 스레드

- 주요 역할
	- 렌더링 커맨드 준비
		- GameThread에서 전달받은 오브젝트의 위치, 재질, 빛 등을 렌더링에 필요한 명령(Command List)으로 정리하고 구성
	- 렌더링 리소스 관리
		- 렌더링에 필요한 텍스처, 셰이더, 버퍼 등의 리소스를 관리

- 작동 방식
	- GameThread가 한 프레임의 연산을 마치면, 다음 렌더링에 필요한 데이터를 **'렌더링 커맨드 큐'에 담아 RenderThread로 전달**한다
	- RenderThread는 이 리스트를 독립적으로 처리하며, 최종적인 **Draw Call** 명령을 내리는 것은 **RHIThread**에게 맡긴다
	- *RenderThread의 주된 임무는 RHIThread가 빠르게 처리할 수 있는 형태로 데이터를 미리 준비하는 것*


#### Thread-Safe 데이터 전송, GameThread에서 RenderThread로

>**Thread-Safe란?**<br>
>**여러 스레드가 동시에 코드를 실행해도 결과가 꼬이지 않도록 안전하게 만드는 것**<br>
>	- 여러 명이 동시에 **하나의 노트**에 글을 쓰려고 하면<br>
>	-> 글자가 겹치거나 지워져서 내용이 엉망이 된다<br>
>**한 사람씩 줄 서서 차례대로 쓰게 하거나, 각자 자기 페이지를 쓰게** 하면 문제없이 깔끔하게 기록된다. 이렇게, 여러 사람이 동시에 작업해도 내용이 망가지지 않게 하는 것을 **Thread-Safe**(**스레드 안전**)라고 부른다
{: .prompt-info}

>**GameThread와 RenderThread**<br>
>GameThread와 RenderThread는 **서로 다른 시점에 동작하는 비동기 스레드**<br>
>따라서 이 둘 사이에 데이터를 안전하게 주고 받는 것은 매우 중요<br>
>언리얼 엔진은 이 문제를 해결하기 위한 핵심 동기화 전략으로 **미러링**(**Mirroring**)을 선택<br>
>GameThread에서 렌더링될 오브젝트들은 RenderThread가 안전하게 접근할 수 있도록 `PrimitiveSceneProxy`라는 **렌더링 전용 데이터 사본**을 만든다
{: .prompt-tip}

- `PrimitiveSceneProxy`
	- **게임 씬에 있는 오브젝트의 렌더링 상태를 담은 스냅샷***(**Snapshot**)
	- 위치, 회전, 스케일, 재질, 메시 등 렌더링에 필요한 모든 정보를 GameThread에서 복사하여 만든다
	- GameThread에서 오브젝트의 상태가 계속 변하더라도, **RenderThread**는 `PrimitiveSceneProxy` **사본만 참조하기 때문에 데이터 충돌**(**Race Condition**)**을 걱정할 필요가 없다**


#### 데이터 전송 과정

1. 프록시 생성
	- GameThread에서 Actor가 새로 생성되거나 상태가 변경되면
	- `UPrimitiveComponent`의 `CreateRenderState_Concurrent` 함수를 통해 해당 Actor의 `PrimitiveSceneProxy`를 생성하거나 업데이트
![프록시 생성.png](/assets/img/posts/file_photos/프록시%20생성.png)

2. 커맨드 큐에 추가
		- 이렇게 생성된 `PrimitiveSceneProxy`는 `ENQUEUE_RENDER_COMMAND` 매크로를 통해 RenderThread의 커맨드 큐에 추가
![커맨드 큐에 추가.png](/assets/img/posts/file_photos/커맨드%20큐에%20추가.png)

3. 렌더링
	- RenderThread는 큐에 있는 `PrimitiveSceneProxy`를 가져와서 렌더링 파이프라인(드로우 콜 생성, GPU 명령 전달 등)을 진행

>이러한 방식은 **GameThread의 게임 로직과 RenderThread의 렌더링 작업이 완전히 분리되어 비동기적으로 진행될 수 있게 하는 핵심적인 요소**
{: .prompt-tip}


#### ENQUEUE_RENDER_COMMAND는 어떻게 동기화를 할까

>Race Condition이란?<br>
>여러 스레드가 동시에 같은 데이터를 바꾸려 할 때 **순서 경쟁 때문에 결과가 꼬이는 문제**<br>
>	- Thread-Safe 아님<br>
>	-> 결과가 실행할 때마다 달라질 수 있다<br>
>	- 여러 스레드가 동시에 Data Write를 할 때 문제 발생
{: .prompt-info}

1. 실제 `ENQUEUE_RENDER_COMMAND` 선언부 매크로
![ENQUEUE_RENDER_COMMAND.png](/assets/img/posts/file_photos/ENQUEUE_RENDER_COMMAND.png)

2. 람다 기준으로 호출되는 `FRenderCommandPipe::Enqueue` 메서드
![Enqueue.png](/assets/img/posts/file_photos/Enqueue.png)

3. `EnqueueUniqueRenderCommand` **메서드가 최종 호출**. 여기에서 특이 사항은 RenderThread가 활성화 되면, `FRenderThreadCommandPipe::Enqueue` 메서드를 호출하게 된다
![EnqueueUniqueRenderCommand.png](/assets/img/posts/file_photos/EnqueueUniqueRenderCommand.png)

4. **실제 큐잉을 하는 곳인** `FRenderThreadCommandPipe::EnqueueAndLaunch` 메서드에서 두 가지 전략이 보인다
	- **더블버퍼링 전략**
		- `Queues[ProduceIndex]`, 두 개 이상의 Queue를 사용해서 GameThread와 RenderThread에서 접근하는 큐를 분리
	- **RenderThread의 TGraphTask에서 큐커멘드 실행**
		- `ProduceIndex ^= 1;` 코드를 통해서 Queues Table의 인덱스가 토글(0 <-> 1)되는 것이 확인된다
![EnqueueAndLaunch.png](/assets/img/posts/file_photos/EnqueueAndLaunch.png)


#### RHIThread(Rendering Hardware Interface Thread)의 역할

>RHIThread의 주된 역할은 **CPU의 메인 스레드와 GPU 사이에 위치하여 렌더링 작업을 효율적으로 처리**하는 것. RHIThread는 이 명령들을 모아 GPU가 이해할 수 있는 형태로 변환하고 드라이버로 전송
{: .prompt-info}

- RHIThread를 사용하는 이유
	- 성능 향상
		- 렌더링 명령을 **별도의 스레드에서 처리함으로써 메인**(**Game/Render**) **스레드의 부하를 줄여준다**. 이를 통해 메인 스레드는 다음 프레임의 게임 로직을 미리 계산할 수 있어 프레임 속도가 향상된다
	- 멀티코어 활용
		- 현대의 멀티코어 CPU 환경을 최대한 활용하여 게임의 **전체적인 성능을 높인다**
	- 렌더링 병목 현상 완화
		- GPU 드라이버에 명령을 제출하는 과정에서 발생하는 **병목 현상을 완화**하여 프레임 레이트의 안정성을 높인다

>RHIThread는 언리얼 엔진의 멀티스레드 렌더링 아케텍쳐의 핵심 구성 요소로, 렌더링 성능 최적화에 중요한 역할을 한다
{: .prompt-tip}


#### 3-프레임 파이프라인

>GPU 지연(GPU Latency)란?<br>
>CPU가 "이 장면 이렇게 그려" 라고 명령을 내린 순간부터, **실제로 GPU가 그 명령을 받아 화면에 픽셀이 찍히기까지 걸리는 시간**<br>
>	- 명령 전송 지연<br>
>		CPU -> 드라이버 -> GPU 명령 큐에 쌓이는 과정<br>
>	- 파이프라인 처리 지연<br>
>		GPU 내부에서 버텍스 처리, 픽셀 셰이딩, 포스트 프로세싱 등 단계별 연산이 직렬로 진행<br>
>	- 동기화 지연<br>
>		GPU가 아직 이전 프레임 연산을 끝내지 않아 CPU가 새 명령을 바로 밀어 넣을 수 없는 경우
{: .prompt-info}

1. 프레임 N, GameThread
	- 역할
		- 현재 프레임의 게임 로직(물리, AI, 캐릭터 이동, UI 등)을 계산
	- 결과
		- 계산이 끝나면, 다음 프레임에 필요한 모든 렌더링 데이터를 '**렌더링 커맨드 큐**(**ENQUEUE_RENDER_COMMAND**)'에 담는다

2. 프레임 N-1, RenderThread
	- 역할
		- GameThread가 만들어 놓은 `프레임 N-1`의 렌더링 커맨드 큐를 가져와서, 실제 렌더링을 하기 위한 데이터들로 재처리를 하게 된다.
	- 결과
		- RHIThread가 빠르게 처리할 수 있는 형태로 데이터를 미리 준비하고 다음 스레드인 RHIThread로 전달

3. 프레임 N-2, RHIThread
	- 역할
		- RenderThread가 전달한 `프레임 N-2`의 Draw Call을 하드웨어(DirectX, Vulkan, Metal)에 보내는 역할
	- 결과
		- GPU는 RHIThread로부터 받은 명령에 따라 화면에 실제 픽셀을 그리기 시작한다


#### 최적화 전략, 스레드 병목 현상 해결하기

1. GameThread 병목 해결
	- 불필요한 Tick 함수 제거
		- 모든 액터가 매 프레임 업데이트할 필요는 없다. **bCanEverTick을 false로 설정**하여 최적화를 진행
	- 무거운 연산 분산
		- 복잡한 계산은 PrallexFor나 태스크 그래프(Task Graph)를 활용해 **여러 스레드로 분산 처리**

2. RenderThread 병목 해결
	- 드로우 콜 최적화
		- Hierarchical Instanced Static Mesh (HISM)/Instanced Static Mesh (ISM)을 활용해 **동일한 메쉬를 여러 개 그릴 때 Draw Call을 하나**로 묶는다
	- 오버드로우(Overdraw) 줄이기
		- **투명한 오브젝트나 파티클을 최소화**하여 GPU가 픽셀을 여러 번 렌더링하는 것을 막는다

3. RHIThread 병목 해결
	- Nanite 관련 최적화
		- 지오메트리 복잡도 vs 픽셀 복잡도
			- Nanite는 지오메트리 복잡도(폴리곤 수)를 거의 무제한으로 허용
			- Nanite의 핵심은 Micro-polygon Rasterization이므로 **화면에 보이는 픽셀을 얼마나 효율적으로 렌더링하는 지가 중요**
			- 오버드로(Overdraw)를 줄이는 것이 여전히 핵심 최적화 과제이다
		- 적합한 메시 사용
			- **Nanite는 복잡한 스태틱 메시에 최적화**되어 있다
			- 스키닝(Skinned)된 캐릭터 메시, 파티클 등에는 Nanite를 적용하지 않아야한다
	- Lumen 관련 최적화
		- 레이 트레이싱 성능 관리
			- Lumen은 다이내믹 GI(Global Illumination)을 위해 Hardware Ray Tracing 또는 Software Ray Tracing을 사용
			- 이는 GPU의 연산 부담을 크게 증가시키며, RHIThread가 관리해야 하는 렌더링 패스(Lumen Scene, Surface Cache 등)을 추가한다
		- 씬 복잡도 최적화
			- Lumen의 레이 트레이싱 성능은 씬에 존재하는 오브젝트의 수와 복잡도에 직접적인 영향을 받는다
			- 씬에 **불필요한 오브젝트를 줄이고 Lumen의 GI 퀄리티 설정을 적절하게 조절**하여 성능을 확보해야 한다
		- 리플렉션 최적화
			- Lumen은 스크린 스페이스 리플렉션(SSR)과 함께 작동
			- Lumen의 리플렉션 퀄리티와 범위를 조절하여 GPU 부하를 관리할 수 있다
		- 셰이더 복잡도 줄이기
			- 복잡한 셰이더는 GPU 연산량을 늘려 RHIThread가 GPU에게 명령을 기다리는 시간을 늘린다
			- 불필요한 연산을 제거하여 셰이더를 최적화해야 한다