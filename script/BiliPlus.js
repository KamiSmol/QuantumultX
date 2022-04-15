let $ = nobyda();
let run = EnvInfo();

async function SwitchRegion(play) {
    const Group = $.read('BiliArea_Policy') || '📺 DomesticMedia'; //Your blibli policy group name.
    const CN = $.read('BiliArea_CN') || 'DIRECT'; //Your China sub-policy name.
    const TW = $.read('BiliArea_TW') || '🇹🇼 sub-policy'; //Your Taiwan sub-policy name.
    const HK = $.read('BiliArea_HK') || '🇭🇰 sub-policy'; //Your HongKong sub-policy name.
    const DF = $.read('BiliArea_DF') || '🏁 sub-policy'; //Sub-policy name used after region is blocked(e.g. url 404)
    const off = $.read('BiliArea_disabled') || ''; //WiFi blacklist(disable region change), separated by commas.
    const current = await $.getPolicy(Group);
    const area = (() => {
        let select;
        if (play === -404) {
            if (current != DF) select = DF;
        } else if (current != CN) {
            select = CN;
        }
        if ($.isQuanX && current === 'direct' && select === 'DIRECT') {
            select = null; //avoid loops in some cases
        }
        return select;
    })()

    if (area && !off.includes($.ssid || undefined)) {
        const change = await $.setPolicy(Group, area);
        const notify = $.read('BiliAreaNotify') === 'true';
        const msg = SwitchStatus(change, current, area);
        if (!notify) {
            $.notify((/^(http|-404)/.test(play) || !play) ? `` : play, ``, msg);
        } else {
            console.log(`${(/^(http|-404)/.test(play) || !play) ? `` : play}\n${msg}`);
        }
        if (change) {
            return true;
        }
    }
    return false;
}

function SwitchStatus(status, original, newPolicy) {
    if (status && typeof original !== 'number') {
        return `${original}  =>  ${newPolicy}  =>  🟢`;
    } else if (original === 2) {
        return `切换失败, 策略组名未填写或填写有误 ⚠️`
    } else if (original === 3) {
        return `切换失败, 不支持您的VPN应用版本 ⚠️`
    } else if (status === 0) {
        return `切换失败, 子策略名未填写或填写有误 ⚠️`
    } else {
        return `策略切换失败, 未知错误 ⚠️`
    }
}

function EnvInfo() {
    const raw = $request.url;
    const res = {
        url: raw
    };
    SwitchRegion(raw).then(() => $done(res));
}

function nobyda() {
    const isHTTP = typeof $httpClient != "undefined";
    const isLoon = typeof $loon != "undefined";
    const isQuanX = typeof $task != "undefined";
    const isSurge = typeof $network != "undefined" && typeof $script != "undefined";
    const ssid = (() => {
        if (isQuanX && typeof ($environment) !== 'undefined') {
            return $environment.ssid;
        }
        if (isSurge && $network.wifi) {
            return $network.wifi.ssid;
        }
        if (isLoon) {
            return JSON.parse($config.getConfig()).ssid;
        }
    })();
    const notify = (title, subtitle, message) => {
        console.log(`${title}\n${subtitle}\n${message}`);
        if (isQuanX) $notify(title, subtitle, message);
        if (isHTTP) $notification.post(title, subtitle, message);
    }
    const read = (key) => {
        if (isQuanX) return $prefs.valueForKey(key);
        if (isHTTP) return $persistentStore.read(key);
    }
    const adapterStatus = (response) => {
        if (!response) return null;
        if (response.status) {
            response["statusCode"] = response.status;
        } else if (response.statusCode) {
            response["status"] = response.statusCode;
        }
        return response;
    }
    const getPolicy = (groupName) => {
        if (isSurge) {
            if (typeof ($httpAPI) === 'undefined') return 3;
            return new Promise((resolve) => {
                $httpAPI("GET", "v1/policy_groups/select", {
                    group_name: encodeURIComponent(groupName)
                }, (b) => resolve(b.policy || 2))
            })
        }
        if (isLoon) {
            if (typeof ($config.getPolicy) === 'undefined') return 3;
            const getName = $config.getPolicy(groupName);
            return getName || 2;
        }
        if (isQuanX) {
            if (typeof ($configuration) === 'undefined') return 3;
            return new Promise((resolve) => {
                $configuration.sendMessage({
                    action: "get_policy_state"
                }).then(b => {
                    if (b.ret && b.ret[groupName]) {
                        resolve(b.ret[groupName][1]);
                    } else resolve(2);
                }, () => resolve());
            })
        }
    }
    const setPolicy = (group, policy) => {
        if (isSurge && typeof ($httpAPI) !== 'undefined') {
            return new Promise((resolve) => {
                $httpAPI("POST", "v1/policy_groups/select", {
                    group_name: group,
                    policy: policy
                }, (b) => resolve(!b.error || 0))
            })
        }
        if (isLoon && typeof ($config.getPolicy) !== 'undefined') {
            const set = $config.setSelectPolicy(group, policy);
            return set || 0;
        }
        if (isQuanX && typeof ($configuration) !== 'undefined') {
            return new Promise((resolve) => {
                $configuration.sendMessage({
                    action: "set_policy_state",
                    content: {
                        [group]: policy
                    }
                }).then((b) => resolve(!b.error || 0), () => resolve());
            })
        }
    }
    const get = (options, callback) => {
        if (isQuanX) {
            options["method"] = "GET";
            $task.fetch(options).then(response => {
                callback(null, adapterStatus(response), response.body)
            }, reason => callback(reason.error, null, null))
        }
        if (isHTTP) {
            if (isSurge) options.headers['X-Surge-Skip-Scripting'] = false;
            $httpClient.get(options, (error, response, body) => {
                callback(error, adapterStatus(response), body)
            })
        }
    }
    return {
        getPolicy,
        setPolicy,
        isSurge,
        isQuanX,
        isLoon,
        notify,
        read,
        ssid,
        get
    }
}
