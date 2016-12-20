+(function () {
  "use strict";

  var userDao = new UserDao(access_token, userId);

  var eventCenter = Arbiter;

  var EVENT_TYPE = {
    "BURN": "updateFirmware",
    "FILTER_DEVICE": "filter_device",
    "UPDATE_ESP": "updateFirmwareForESP"
  };

  // 目前內容產生在 sinkEvents 相關的 modal.
  var viewModel = {
    deviceInfo: new Vue({
      el: '.js-vue-deviceInfo',
      data: {
        device: {}
      },
      methods: {
        setDevice: function(data) {
          var key = '_' + data.deviceId;
          if (this.device[key]) {
            this.device[key] = data;
          } else {
            this.$set('device.' + key, data);
          }
        },
        getDevice: function(id) {
          var key = '_' + id;
          return this.device[key];
        }
      }
    }),
    modal: {
      toolbar_myfile: null,
      addDevice: null,
      linkDevice: null,
      burn: null,
      burnMark1: null,
      burnFly: null,
      burnSmart: null
    },
    other: {
      dashboard: null
    }
  };

  updateLanguageValue();
  
  initI18n(function (lng) {
    initInfo();
    initDashboard();
    initMyFileTable();
    sinkEvents();

    myMqtt({
      onMessage: function(data, msgType) {
        console.log('mqtt', data, data.deviceId);

        if (!msgType) {
          updateTable_myfile([data]);
          viewModel.deviceInfo.setDevice(data);
        }

        switch(msgType) {
          case 'updateFirmware':
            eventCenter.publish(EVENT_TYPE.BURN, data);
            break;
          case 'updateFirmwareForESP':
            eventCenter.publish(EVENT_TYPE.UPDATE_ESP, data);
            break;
          default:
            break;
        }
      }
    });
  });

  function initInfo() {
    userDao.getUser().done(function (data, status, xhr) {
      userDao.getUserIdentities().done(function (identities, status, xhr) {
        $('.email').html('<i class="glyphicon glyphicon-user"></i> ' + identities.profile.emails[0].value + ' (' + identities.profile.displayName + ')');
      }).fail(function (xhr, status, error) {
        $('.email').html('<i class="glyphicon glyphicon-user"></i> ' + data.email);
      });
    }).fail(function (xhr, status, error) {
      Cookies.remove('access_token');
      Cookies.remove('userId');
      location.href = '/signin.html';
    });
  }

  function initDashboard() {
    var vm =  new Vue({
      el: '#dashboard',
      data: {
        active: {
          all: true,
          mark1: false,
          fly: false,
          smart: false
        },
        num: {
          all: 0,
          mark1: 0,
          fly: 0,
          smart: 0
        },
        text: {
          all: '',
          mark1: '',
          fly: '',
          smart: ''
        }
      },
      watch: {
        'num': {
          handler: function(val, oldVal) {
            var self = this;
            Object.keys(val).forEach(function(key, idx) {
              self.text[key] = '( ' + val[key] + ' )';
            });
          },
          deep: true
        }
      },
      methods: {
        _changeActiveTab: function(deviceType) {
          var key;
          for (key in this.active) {
            this.active[key] = (key === deviceType);
          }
        },
        click: function(filterType) {
          this._changeActiveTab(filterType);
          eventCenter.publish(EVENT_TYPE.FILTER_DEVICE, {
            filterDevice: filterType
          });
        },
        getActive: function() {
          var key;
          for (key in this.active) {
            if (this.active[key]) {
              return key;
            }
          }
        },
        updateDevice: function(deviceNum) {
          var thisNum = this.num;
          var counts = 0;
          var key;
          for (var key in deviceNum) {
            if (thisNum[key] !== undefined) {
              thisNum[key] = deviceNum[key];
            }
            counts += deviceNum[key];
          }
          thisNum.all = counts;
        }
      }
    });
    viewModel.other.dashbaord = vm;
  }

  /**
   * 我的裝置
   */
  function initMyFileTable() {
    var $table = $('.js-myfile-table');

    // table initialize
    $table.bootstrapTable({
      height: 500,
      idField: 'id',
      formatSearch: function () {
        return i18n.t('webduinoDevice.searchName');
      },
      classes: 'table table-hover table-no-bordered',
      undefinedText: '-',
      escape: true,
      columns: [{
        field: 'state',
        checkbox: true,
        valign: 'middle',
        visible: true
      }, {
        field: 'deviceId',
        title: i18n.t('webduinoDevice.fieldTitle.deviceId'),
        sortable: true,
        searchable: true,
        editable: false,
        clickToSelect: false,
        valign: 'middle'
      }, {
        field: 'status',
        title: i18n.t('webduinoDevice.fieldTitle.status'),
        sortable: true,
        searchable: false,
        valign: 'middle',
        clickToSelect: false,
        formatter: statusFormatter
      }, {
        field: 'linkDevice',
        title: i18n.t('webduinoDevice.fieldTitle.linkDevice'),
        sortable: true,
        searchable: false,
        clickToSelect: false,
        valign: 'middle',
        events: {
          'click .js-link': function (e, value, row, index) {
            viewModel.modal.linkDevice.changedPK = row.id;
            viewModel.modal.linkDevice.deviceId = row.deviceId;
            viewModel.modal.linkDevice.deviceType = row.deviceType;
          }
        },
        formatter: formatter_linkDevice
      }, {
        field: 'deviceType',
        title: i18n.t('webduinoDevice.fieldTitle.deviceType'),
        sortable: true,
        searchable: false,
        clickToSelect: false,
        valign: 'middle',
        formatter: deviceTypeFormatter
      }, {
        field: 'explanation',
        title: i18n.t('webduinoDevice.fieldTitle.explanation'),
        sortable: true,
        searchable: false,
        clickToSelect: false,
        valign: 'middle',
        formatter: explanationFormatter
      }, {
        field: 'comment',
        title: i18n.t('webduinoDevice.fieldTitle.comment'),
        sortable: true,
        searchable: false,
        clickToSelect: false,
        editable: {
          title: i18n.t('webduinoDevice.fieldEditTitle.comment'),
          emptytext:'...',
          validate: function(value) {
            // console.log('...', value);
            // return 'the value is invalid.';
          },
          url: function(fieldInfo) {
            var d = new $.Deferred();
            userDao.updateProject(fieldInfo.pk, {
              comment: fieldInfo.value
            }).done(function() {
              d.resolve();
              refreshFileTable();
            }).fail(function() {
              var msg = i18n.t('other.message.changeCommentFail');
              return d.reject(msg);
            });
            return d.promise();
          }
        },
        clickToSelect: false,
        valign: 'middle'
      }, {
        field: 'modifyTime',
        title: i18n.t('webduinoDevice.fieldTitle.modifyTime'),
        sortable: true,
        searchable: false,
        clickToSelect: false,
        valign: 'middle',
        formatter: datetimeFormatter
      }],
      url: '/api/users/' + userId + '/projects/detail?access_token=' + access_token
    });
  }

  /**
   * 更新 table row 
   * @param  {Array} data [row datas]
   */
  function updateTable_myfile(data) {
    var $table = $('.js-myfile-table');
    var allData = $table.bootstrapTable('getData');
    data.forEach(function(val, idx, ary) {
      var rowData;

      $.each(allData, function(idx2, val2) {
        if (val.deviceId === val2.deviceId) {
          rowData = val2;
          return false;
        }
      });

      // 找不到資料時，表示無此開發板。
      if (!rowData) {
        return;
      }
      
      rowData.status = val.status;
      $table.bootstrapTable('updateByUniqueId', {
        id: val.id,
        row: rowData
      });
    });
  }

  /**
   * table 重新整理
   */
  function refreshFileTable(isKeepSelect) {
    var $table = $('.js-myfile-table');
    var ids = [];
    var selections;
    
    if (isKeepSelect) {
      selections = $table.bootstrapTable('getSelections');
      $.each(selections, function(idx, val) {
        ids.push(val.id);
      });

      // 透過 url 更新，所以不使用 refresh 事件
      $table.one('load-success.bs.table', function() {        
        $table.bootstrapTable("checkBy", {
          field: "id", 
          values: ids
        });
      });
    }

    $table.bootstrapTable('refresh');
  }

  /**
   * 過濾 table 內容
   * @param  {string} filterType [all|mark1|fly|smart]
   * @return {None}
   */
  function filterTableByDeviceType(filterType) {
    var $table = $('.js-myfile-table');
    var filterObj = {};
    if (filterType !== 'all') {
      filterObj.deviceType = filterType;
    }
    $table.bootstrapTable('filterBy', filterObj);
  }

  function sinkEvents() {
    var $dashboard = $('.dashboard-nav');
    var $toolbar = $('.k2-my-toolbar');
    var $main = $('#edit-area');
    var $document = $(document);
    var $table = $('.js-myfile-table');
    var tmpTimer;

    updateMyfileTableHeight();

    // device table toolbar
    sinkEvents_toolbar_myfile();

    // add device
    sinkEvents_addDevice();

    // link device
    sinkEvents_linkDevice();

    // burn firmware
    sinkEvents_burn();

    // update firmware for mark1
    sinkEvents_burn_mark1();

    // update firmware for fly
    sinkEvents_burn_fly();

    // update firmware for smart
    sinkEvents_burn_smart();

    $('.js-logout').on('click', function () {
      logOut();
    });

    $('#language').on('change', function () {
      var currentLng = getLocationSearch()['lang'];
      var lang = $(this).children('option:selected').get(0).value;

      if (currentLng) {
        location = location.href.replace("lang=" + currentLng, 'lang=' + lang);
      } else {
        location.search = location.search ? (location.search + "&lang=" + lang) : 'lang=' + lang;
      }
    });

    eventCenter.subscribe(EVENT_TYPE.FILTER_DEVICE, function(data, eventType) {
      filterTableByDeviceType(data.filterDevice);
    });

    // Update the device's number in dashboard
    $table.on('load-success.bs.table', function() { 
      var allData = $table.bootstrapTable('getOptions').data;
      var vm_dashboard = viewModel.other.dashbaord;
      var deviceNum = {
        other: 0 // 沒有 deviceType 的板子
      };
      $.each(allData, function(idx, val) {
        var dt = val.deviceType;
        if (dt) {
          deviceNum[dt] === undefined ? (deviceNum[dt] = 1) : ++deviceNum[dt];
        } else {
          ++deviceNum.other;
        }
      });
      vm_dashboard.updateDevice(deviceNum);
    });

    $(window).on('resize', function() {
      clearTimeout(tmpTimer);
      tmpTimer = setTimeout(updateMyfileTableHeight, 300);
    });

    function updateMyfileTableHeight() {
      var height = $main.children('div').first().height();
      var oldHeight = $table.bootstrapTable('getOptions').height;
      if (height !== oldHeight) {
        $table.bootstrapTable('refreshOptions', {height: height});
      } 
    }

    // 處理 caret
    // $dashboard.on('show.bs.collapse hide.bs.collapse', function (evt) {
    //   $(evt.target).parent().toggleClass('open');
    // });

    // 處理 active li
    // $dashboard.on('click', 'li', function (evt) {
    //   if (evt.target.getAttribute('data-toggle')) {
    //     return;
    //   }
    //   $dashboard.find('li').removeClass('active');
    //   $(evt.target).parent().addClass('active');
    // });

    // 切換內容
    // $dashboard.on('click', '[data-target]', function (evt) {
    //   var target = evt.target.getAttribute('data-target');
    //   $main[0].className = target;
    // });

    // 處理 navbar profile
    // $('.js-profile').on('click', function () {
    //   $('#accountContent').collapse('show');
    //   $('[data-target="profile"]').trigger('click');
    // });

    // 處理 share
    // $('.js-share-exec').on('click', function () {
    //   userDao.updateProject($('#sharedPK').val(), {
    //     share: JSON.stringify($('#shareToUser').val().trim().split(','))
    //   }).done(function () {
    //     refreshFileTable();
    //   });
    // });

    // // table: myfile
    // $('.js-myfile-table').on('click-cell.bs.table', function (evt, field, value, row, $element) {
    //   if (field === 'name') {
    //     window.open('./#' + row.id, '_blank');
    //   }
    // });

    // // table: sharefile
    // $('.js-sharedfile-table').on('click-cell.bs.table', function (evt, field, value, row, $element) {
    //   if (field === 'name') {
    //     window.open('./#' + row.id, '_blank');
    //   }
    // });
  }

  function sinkEvents_toolbar_myfile() {
    var $table = $('.js-myfile-table');
    var vm = new Vue({
      el: '#edit-area .webduinoDevice .k2-my-toolbar',
      data: {
        disabled_remove: true,
        disabled_burn: true,
        title_remove: i18n.t('toolbar.remove.disabled'),
        title_burn: i18n.t('toolbar.burn.disabled'),
        modalType: ''
      },
      methods: {
        disableBtn_remove: disableBtn_remove,
        disableBtn_burn: disableBtn_burn,
        remove: remove,
        chkModalType: chkModalType
      },
      watch: {
        title_remove: function(val, oldVal) {
          $(this.$el).find('.js-remove').parent().data('bs.tooltip').options.title = val;
        },
        title_burn: function(val, oldVal) {
          $(this.$el).find('.js-burn').parent().data('bs.tooltip').options.title = val;
        }
      }
    });

    viewModel.modal.toolbar_myfile = vm;

    $table.on('check.bs.table check-all.bs.table uncheck.bs.table uncheck-all.bs.table load-success.bs.table', function() {
      var data = $table.bootstrapTable('getAllSelections');

      // 決定按鈕狀態
      vm.disableBtn_remove(data);
      vm.disableBtn_burn(data);

      // 決定 modalType
      vm.chkModalType(data);
    });

    // 初始化 tooltip
    $('#edit-area .k2-my-toolbar [data-toggle="tooltip"]').tooltip({
      container: 'body'
    });

    function remove() {
      var selects = $table.bootstrapTable('getAllSelections');
      var deviceIds = [];

      selects.forEach(function(val, idx, ary) {
        deviceIds.push(val.deviceId);
      });

      var diaglog = bootbox.confirm({
        "title": i18n.t('remove-device.title'),
        "message": deviceIds.join(', '),
        "size": "small",
        "buttons": {
          "confirm": {
            label: i18n.t('remove-device.confirm')
          },
          "cancel": {
            label: i18n.t('remove-device.cancel')
          }
        },
        callback: function(result) {
          if (!result) {
            return;
          }
          var info = {
            data: deviceIds
          };

          userDao.deleteDevice(info)
            .done(function() {
              refreshFileTable();
              diaglog.modal('hide');
            })
            .fail(function() {
              bootbox.alert({
                "message": i18n.t('other.message.removeDeviceFail'),
                "size": "small",
                "buttons": {
                  "ok": {
                    label: i18n.t('remove-device.confirm')
                  }
                }
              });
            });

          return false;
        }
      });
    }

    /**
     * 決定移除按鈕是否 disabled
     * @param  {array}  data
     */
    function disableBtn_remove(data) {
      if (data.length < 1) {
        this.disabled_remove = true;
        this.title_remove = i18n.t('toolbar.remove.disabled');
      } else {
        this.disabled_remove = false;
        this.title_remove = i18n.t('toolbar.remove.exec');
      }
    }
    
    /**
     * 決定燒錄韌體按鈕是否 disabled
     * @param  {array}  data
     */
    function disableBtn_burn(data) {
      var filterData;
      var dt = '';
      var isDisabled = false;

      if (data.length < 1) {
        this.disabled_burn = true;
        this.title_burn = i18n.t('toolbar.burn.disabled');
        return;
      }

      // 判斷選項是否開發板種類一致
      filterData = data.filter(function(val) {
        return !!val.deviceType;
      });

      filterData[0] && (dt = filterData[0].deviceType);

      filterData.forEach(function(val) {
        if (dt !== val.deviceType) {
          isDisabled = true;
        }
      });

      this.disabled_burn = isDisabled;

      if (isDisabled) {
        this.title_burn = i18n.t('toolbar.burn.deviceTypeIncorrect');
      } else {
        this.title_burn = i18n.t('toolbar.burn.exec');
      }
    }

    /**
     * 檢查並設定 modalType
     * @param  {array} data [選擇的資料列]
     */
    function chkModalType(data) {
      var list = {
        'mark1': '.js-modal-burn-mark1',
        'fly': '.js-modal-burn-fly',
        'smart': '.js-modal-burn-smart'
      };
      var filterData = data.filter(function(val) {
        return !!val.deviceType;
      });
      var modalType = (filterData[0] && filterData[0].deviceType) || '';

      list[modalType] && (this.modalType = list[modalType]);
    }

  }

  function sinkEvents_addDevice() {
    var $modal = $('.js-modal-addDevice');
    var $form = $modal.find('form').first();
    var laddaBtn = Ladda.create($modal.find('.js-exec').get(0));
    var vm = new Vue({
      el: '.js-modal-addDevice',
      data: {
        deviceId: '',
        deviceType: 'mark1',
        comment: '',
        message: ''
      },
      methods: {
        clear: function() {
          this.deviceId = '';
          this.deviceType = 'mark1';
          this.comment = '';
          this.message = '';
        },
        exec: function() {
          var self = this;

          this.message = '';
          $form.validator('validate');

          if (!$form.data('bs.validator').hasErrors()) {
            laddaBtn.start();
            addDevice(function(info) {
              setTimeout(function() {
                laddaBtn.stop();

                if (info.status) {
                  refreshFileTable();
                  $modal.modal('hide');
                } else {
                  self.message = info.msg;
                }
              }, 500);
            });
          }
        }
      }
    });

    viewModel.modal.addDevice = vm;

    $modal.on('shown.bs.modal', function(evt) {
      // focus 欄位
      $('#addDeviceId').focus();

      // 初始化 validator
      $form.validator();
    });

    $modal.on('hidden.bs.modal', function(evt) {
      // 停止 ladda button
      laddaBtn.stop();

      // 清除 validator
      $form.validator('destroy');

      // 清除欄位資料
      vm.clear();
    });

    function addDevice(cb) {
      var info = { 
        data: {
          deviceId: vm.deviceId,
          deviceType: vm.deviceType,
          comment: vm.comment
        }
      };
      userDao.addDevice(info)
        .done(function (data, status, xhr) {
          console.log('addDevice..', data);
          var msgPath = 'other.message.add-device.' + data.message;
          var msg = i18n.t(msgPath);
          msg === msgPath && (msg = '');

          if (data.status) {
            msg = i18n.t('other.message.addDeviceSuccess');
          } else {
            msg = msg || i18n.t('other.message.addDeviceFail');
          }

          cb({
            status: data.status,
            msg: msg
          });
        })
        .fail(function() {
          cb({
            status: false,
            msg: i18n.t('other.message.addDeviceFail')
          });
        });
    }
  }

  function sinkEvents_linkDevice() {
    var $modal_step2 = $('.js-modal-linkDevice-step2');
    var $modal_step3 = $('.js-modal-linkDevice-step3');
    var laddaBtn = Ladda.create($modal_step3.find('.js-exec').get(0));
    var $container = $('.js-modal-linkDevice-container');
    var vm_device = viewModel.deviceInfo;

    var vm = new Vue({
      el: '.js-modal-linkDevice-container',
      data: {
        changedPK: '',
        deviceId: '',
        deviceType: '',
        message: '',
        isFailed: false,
        isDisabledNext_step1: true,
        isDisabledNext_step2: true
      },
      methods: {
        verify: function() {
          var self = this;
          var status;
          var msg;
          var msgPath;
          var info = {
            data: {
              deviceId: self.deviceId,
              deviceType: self.deviceType
            }
          };
          
          laddaBtn.start();
          userDao.linkDevice(self.changedPK, info)
            .done(function(data) {
              status = data.status;
              msgPath = 'other.message.link-device.' + data.message;
              msg = i18n.t(msgPath);
              msg === msgPath && (msg = '');
            }).fail(function() {
              status = false;
            }).always(function() {
              // 因為要表現 ladda 的效果，配合 timer，所以將部份行為放在這裡做。
              setTimeout(function() {
                laddaBtn.stop();

                if (status) {
                  refreshFileTable();
                  $modal_step3.modal('hide');
                  notify({ message: i18n.t('other.message.linkDeviceSuccess') });
                } else {
                  msg = msg || i18n.t('other.message.linkDeviceFail');
                  self.message = msg;
                  self.isFailed = true;
                }
              }, 500);
            });
        },
        reVerify: function() {
          var self = this;
          var device = vm_device.getDevice(this.deviceId);
          var changedPK = this.changedPK;
          var deviceId = this.deviceId;

          // 上線狀態，回到第二步驟，非上線狀態，就停在第三步驟
          if (device.status) {
            $modal_step3.modal('hide');

            // 在 modal3 隱藏時，已經回復所有狀態，所以需要重新給值
            $modal_step2.one('shown.bs.modal', function(evt) {
              self.changedPK = changedPK;
              self.deviceId = deviceId;
            });
            $modal_step2.modal('show');
          } else {
            this.isFailed = false;
            this.verify();
          }
        },
        clear: function() {
          this.changedPK = '';
          this.deviceId = '';
          this.message = '';
          this.isFailed = false;
          this.isDisabledNext_step1 = true;
          this.isDisabledNext_step2 = true;
        }
      }
    });

    viewModel.modal.linkDevice = vm;

    // 當 modal 隱藏時，做處理
    $modal_step3.on('hidden.bs.modal', function(evt) {
      // 停止 ladda button
      laddaBtn.stop();

      // 清除資料，恢復預設值
      vm.clear();
    });

    // 控制步驟一、二的按鈕狀態
    $container.on('show.bs.modal', function(evt) {
      var $target = $(evt.target);
      var clazz = $target.prop('class');
      var reg = /js-modal-linkDevice-step(\w)/;
      var watch_path = 'device._' + vm.deviceId;
      var currentStep;
      var unwatch;

      if (reg.test(clazz)) {
        currentStep = Number(reg.exec(clazz)[1]);
      }

      switch(currentStep) {
        case 1:
          unwatch = vm_device.$watch(watch_path, function(newVal, oldVal) {
            if (newVal.status) {
              vm.isDisabledNext_step1 = false;
              unwatch();
            }
          });
          break;
        case 2:
          unwatch = vm_device.$watch(watch_path, function(newVal, oldVal) {
            if (!newVal.status) {
              vm.isDisabledNext_step2 = false;
              unwatch();
            }
          });
          break;      
      }
    });
  }

  function sinkEvents_burn() {
    var $modal = $('.js-modal-burn');
    var progressBar = getProgressBar('.js-modal-burn');
    var laddaBtn = Ladda.create($modal.find('.js-exec').get(0));

    var vm = new Vue({
      el: '.js-modal-burn',
      data: {
        deviceType: 'mark1',
        firmwareType: 1,
        burning: false,
        message: ''
      },
      methods: {
        init: function() {
          this.deviceType = 'mark1';
          this.firmwareType = 1;
          this.message = '';
        },
        exec: exec
      }
    });

    viewModel.modal.burn = vm;

    // 當 modal 隱藏時，做處理
    $modal.on('hidden.bs.modal', function(evt) {
      // 停止 ladda button
      laddaBtn.stop();

      // 恢復初始化訊息
      vm.init();
    });

    function exec() {
      var self = this;
      var $table = $('.js-myfile-table');
      var msgAry = [];
      var msgAry_mqtt = [];
      var status = true;
      var info = { 
        data: {
          projectIds: [],
          deviceType: self.deviceType,
          firmwareType: self.firmwareType
        }
      };
      var selects = $table.bootstrapTable('getAllSelections');

      if (selects.length < 1) {
        return false;
      }

      selects.forEach(function(val, idx, ary) {
        info.data.projectIds.push(val.id);
      });
      
      self.message = '';
      self.burning = true;
      progressBar.progress(99);
      laddaBtn.start();

      // 透過 mqtt 拋送燒錄的訊息
      var subscribeId = eventCenter.subscribe(EVENT_TYPE.BURN, function(data, eventType) {
        var row = $table.bootstrapTable('getRowByUniqueId', data.id);
        var msg = '';
        var msgPath;

        if (!data.status) {
          msgPath = 'other.message.burnFirmware.' + data.message;
          msg = i18n.t(msgPath);
          msg === msgPath && (msg = i18n.t('other.message.burningFail'));
          msgAry_mqtt.push({
            status: false,
            deviceId: row.deviceId,
            message: msg 
          });
        } else {
          msgAry_mqtt.push({
            status: true,
            deviceId: row.deviceId,
            message: i18n.t('other.message.burningSuccess') 
          });
        }

        self.message = msgAry_mqtt;
      });

      userDao.burn(info)
        .done(function(data) {
          console.log("結果", data);
          var msg = '';
          var msgPath;
          var row;

          data.forEach(function(val, idx, ary) {
            row = $table.bootstrapTable('getRowByUniqueId', val.id);
            if (!val.status) {
              status = false;
              msgPath = 'other.message.burnFirmware.' + val.message;
              msg = i18n.t(msgPath);
              msg === msgPath && (msg = i18n.t('other.message.burningFail'));
              msgAry.push({
                status: false,
                deviceId: row.deviceId,
                message: msg 
              });
            } else {
              msgAry.push({
                status: true,
                deviceId: row.deviceId,
                message: i18n.t('other.message.burningSuccess') 
              });
            }
          });
        })
        .fail(function() {
          status = false;
        })
        .always(function() {
          progressBar.progress(100);
          // 因為要表現 ladda 的效果，配合 timer，所以將部份行為放在這裡做。
          setTimeout(function() {
            laddaBtn.stop();
            self.burning = false;
            progressBar.reset();
            eventCenter.unsubscribe(subscribeId);

            // 更新 table
            status && refreshFileTable(true);

            // 更新訊息
            if (msgAry.length) {
              if (msgAry.length !== msgAry_mqtt.length) {
                self.message = msgAry;
              }
            } else {
              if (!status) {
                self.message = i18n.t('other.message.burningFail');
              }
            }
          }, 500);
        });
    }

  }

  function sinkEvents_burn_mark1() {
    var selector = '.js-modal-burn-mark1';
    var $modal = $(selector);
    var progressBar = getProgressBar(selector);
    var laddaBtn = Ladda.create($modal.find('.js-exec').get(0));

    var vm = new Vue({
      el: selector,
      data: {
        deviceType: 'mark1',
        firmwareType: 1,
        burning: false,
        message: ''
      },
      methods: {
        init: function() {
          this.firmwareType = 1;
          this.message = '';
        },
        exec: exec
      }
    });

    viewModel.modal.burnMark1 = vm;

    // 當 modal 隱藏時，做處理
    $modal.on('hidden.bs.modal', function(evt) {
      // 停止 ladda button
      laddaBtn.stop();

      // 恢復初始化訊息
      vm.init();
    });

    function exec() {
      var self = this;
      var $table = $('.js-myfile-table');
      var msgAry = [];
      var msgAry_mqtt = [];
      var status = true;
      var info = { 
        data: {
          projectIds: [],
          deviceType: self.deviceType,
          firmwareType: self.firmwareType
        }
      };
      var selects = $table.bootstrapTable('getAllSelections');

      if (selects.length < 1) {
        return false;
      }

      selects.forEach(function(val, idx, ary) {
        info.data.projectIds.push(val.id);
      });
      
      self.message = '';
      self.burning = true;
      progressBar.progress(99);
      laddaBtn.start();

      // 透過 mqtt 拋送燒錄的訊息
      var subscribeId = eventCenter.subscribe(EVENT_TYPE.BURN, function(data, eventType) {
        var row = $table.bootstrapTable('getRowByUniqueId', data.id);
        var msg = '';
        var msgPath;

        if (!data.status) {
          msgPath = 'other.message.burnMark1.' + data.message;
          msg = i18n.t(msgPath);
          msg === msgPath && (msg = i18n.t('other.message.burningFail'));
          msgAry_mqtt.push({
            status: false,
            deviceId: row.deviceId,
            message: msg 
          });
        } else {
          msgAry_mqtt.push({
            status: true,
            deviceId: row.deviceId,
            message: i18n.t('other.message.burningSuccess') 
          });
        }

        self.message = msgAry_mqtt;
      });

      userDao.burn(info)
        .done(function(data) {
          console.log("結果", data);
          var msg = '';
          var msgPath;
          var row;

          data.forEach(function(val, idx, ary) {
            row = $table.bootstrapTable('getRowByUniqueId', val.id);
            if (!val.status) {
              status = false;
              msgPath = 'other.message.burnMark1.' + val.message;
              msg = i18n.t(msgPath);
              msg === msgPath && (msg = i18n.t('other.message.burningFail'));
              msgAry.push({
                status: false,
                deviceId: row.deviceId,
                message: msg 
              });
            } else {
              msgAry.push({
                status: true,
                deviceId: row.deviceId,
                message: i18n.t('other.message.burningSuccess') 
              });
            }
          });
        })
        .fail(function() {
          status = false;
        })
        .always(function() {
          progressBar.progress(100);
          // 因為要表現 ladda 的效果，配合 timer，所以將部份行為放在這裡做。
          setTimeout(function() {
            laddaBtn.stop();
            self.burning = false;
            progressBar.reset();
            eventCenter.unsubscribe(subscribeId);

            // 更新 table
            status && refreshFileTable(true);

            // 更新訊息
            if (msgAry.length) {
              if (msgAry.length !== msgAry_mqtt.length) {
                self.message = msgAry;
              }
            } else {
              if (!status) {
                self.message = i18n.t('other.message.burningFail');
              }
            }
          }, 500);
        });
    }

  }

  function sinkEvents_burn_fly() {
    var selector = '.js-modal-burn-fly';
    var $modal = $(selector);
    var progressBar = getProgressBar(selector);
    var laddaBtn = Ladda.create($modal.find('.js-exec').get(0));

    var vm = new Vue({
      el: selector,
      data: {
        deviceType: 'fly',
        firmwareType: 1,
        burning: false,
        message: ''
      },
      methods: {
        init: function() {
          this.firmwareType = 1;
          this.message = '';
        },
        exec: exec
      }
    });

    viewModel.modal.burnFly = vm;

    // 當 modal 隱藏時，做處理
    $modal.on('hidden.bs.modal', function(evt) {
      // 停止 ladda button
      laddaBtn.stop();

      // 恢復初始化訊息
      vm.init();
    });

    function exec() {
      var self = this;
      var $table = $('.js-myfile-table');
      var msgAry = [];
      var msgAry_mqtt = [];
      var status = true;
      var info = { 
        data: {
          projectIds: [],
          deviceType: self.deviceType,
          firmwareType: self.firmwareType
        }
      };
      var selects = $table.bootstrapTable('getAllSelections');

      if (selects.length < 1) {
        return false;
      }

      selects.forEach(function(val, idx, ary) {
        info.data.projectIds.push(val.id);
      });
      
      self.message = '';
      self.burning = true;
      progressBar.progress(99);
      laddaBtn.start();

      // 透過 mqtt 拋送燒錄的訊息
      var subscribeId = eventCenter.subscribe(EVENT_TYPE.BURN, function(data, eventType) {
        var row = $table.bootstrapTable('getRowByUniqueId', data.id);
        var msg = '';
        var msgPath;

        if (!data.status) {
          msgPath = 'other.message.burnFly.' + data.message;
          msg = i18n.t(msgPath);
          msg === msgPath && (msg = i18n.t('other.message.burningFail'));
          msgAry_mqtt.push({
            status: false,
            deviceId: row.deviceId,
            message: msg 
          });
        } else {
          msgAry_mqtt.push({
            status: true,
            deviceId: row.deviceId,
            message: i18n.t('other.message.burningSuccess') 
          });
        }

        self.message = msgAry_mqtt;
      });

      userDao.burn(info)
        .done(function(data) {
          console.log("結果", data);
          var msg = '';
          var msgPath;
          var row;

          data.forEach(function(val, idx, ary) {
            row = $table.bootstrapTable('getRowByUniqueId', val.id);
            if (!val.status) {
              status = false;
              msgPath = 'other.message.burnFly.' + val.message;
              msg = i18n.t(msgPath);
              msg === msgPath && (msg = i18n.t('other.message.burningFail'));
              msgAry.push({
                status: false,
                deviceId: row.deviceId,
                message: msg 
              });
            } else {
              msgAry.push({
                status: true,
                deviceId: row.deviceId,
                message: i18n.t('other.message.burningSuccess') 
              });
            }
          });
        })
        .fail(function() {
          status = false;
        })
        .always(function() {
          progressBar.progress(100);
          // 因為要表現 ladda 的效果，配合 timer，所以將部份行為放在這裡做。
          setTimeout(function() {
            laddaBtn.stop();
            self.burning = false;
            progressBar.reset();
            eventCenter.unsubscribe(subscribeId);

            // 更新 table
            status && refreshFileTable(true);

            // 更新訊息
            if (msgAry.length) {
              if (msgAry.length !== msgAry_mqtt.length) {
                self.message = msgAry;
              }
            } else {
              if (!status) {
                self.message = i18n.t('other.message.burningFail');
              }
            }
          }, 500);
        });
    }

  }

  function sinkEvents_burn_smart() {
    var selector = '.js-modal-burn-smart';
    var $modal = $(selector);
    var progressBar = getProgressBar(selector);
    var laddaBtn = Ladda.create($modal.find('.js-exec').get(0));

    var vm = new Vue({
      el: selector,
      data: {
        deviceType: 'smart',
        burning: false,
        message: ''
      },
      methods: {
        init: function() {
          this.message = '';
        },
        exec: exec
      }
    });

    viewModel.modal.burnSmart = vm;

    // 當 modal 隱藏時，做處理
    $modal.on('hidden.bs.modal', function(evt) {
      // 停止 ladda button
      laddaBtn.stop();

      // 恢復初始化訊息
      vm.init();
    });

    function exec() {
      var self = this;
      var $table = $('.js-myfile-table');
      var msgAry = [];
      var msgAry_mqtt = [];
      var status = true;
      var info = { 
        data: {
          projectIds: [],
          deviceType: self.deviceType
        }
      };
      var selects = $table.bootstrapTable('getAllSelections');

      if (selects.length < 1) {
        return false;
      }

      selects.forEach(function(val, idx, ary) {
        info.data.projectIds.push(val.id);
      });
      
      self.message = '';
      self.burning = true;
      progressBar.progress(99);
      laddaBtn.start();

      // 透過 mqtt 拋送燒錄的訊息
      var subscribeId = eventCenter.subscribe(EVENT_TYPE.UPDATE_ESP, function(data, eventType) {
        var row = $table.bootstrapTable('getRowByUniqueId', data.id);
        var msg = '';
        var msgPath;

        if (!data.status) {
          msgPath = 'other.message.burnSmart.' + data.message;
          msg = i18n.t(msgPath);
          msg === msgPath && (msg = i18n.t('other.message.updateFailed'));
          msgAry_mqtt.push({
            status: false,
            deviceId: row.deviceId,
            message: msg 
          });
        } else {
          msgAry_mqtt.push({
            status: true,
            deviceId: row.deviceId,
            message: i18n.t('other.message.updateSuccess') 
          });
        }

        self.message = msgAry_mqtt;
      });

      userDao.updateESP(info)
        .done(function(data) {
          console.log("結果", data);
          var msg = '';
          var msgPath;
          var row;

          data.forEach(function(val, idx, ary) {
            row = $table.bootstrapTable('getRowByUniqueId', val.id);
            if (!val.status) {
              status = false;
              msgPath = 'other.message.burnSmart.' + val.message;
              msg = i18n.t(msgPath);
              msg === msgPath && (msg = i18n.t('other.message.updateFailed'));
              msgAry.push({
                status: false,
                deviceId: row.deviceId,
                message: msg 
              });
            } else {
              msgAry.push({
                status: true,
                deviceId: row.deviceId,
                message: i18n.t('other.message.updateSuccess') 
              });
            }
          });
        })
        .fail(function() {
          status = false;
        })
        .always(function() {
          progressBar.progress(100);
          // 因為要表現 ladda 的效果，配合 timer，所以將部份行為放在這裡做。
          setTimeout(function() {
            laddaBtn.stop();
            self.burning = false;
            progressBar.reset();
            eventCenter.unsubscribe(subscribeId);

            // 更新 table
            status && refreshFileTable(true);

            // 更新訊息
            if (msgAry.length) {
              if (msgAry.length !== msgAry_mqtt.length) {
                self.message = msgAry;
              }
            } else {
              if (!status) {
                self.message = i18n.t('other.message.updateFailed');
              }
            }
          }, 500);
        });

    }

  }

  function datetimeFormatter(value, row, index) {
    return moment(value).format('YYYY-MM-DD HH:mm');
  }

  function explanationFormatter(value, row, index) {
    var deviceType = row.deviceType;
    var firmwareType = row.firmwareType;
    var text;

    if (!firmwareType || !deviceType) {
      return value;
    }

    if (deviceType === 'mark1') {
      text = i18n.t('burnMark1.explanationPrefix') + '' + i18n.t('burnMark1.fmType.val' + firmwareType);
    }

    if (deviceType === 'fly') {
      text = i18n.t('burnFly.explanationPrefix') + '' + i18n.t('burnFly.fmType.val' + firmwareType);
    }

    return '<span>' + text + '</span>';
  }

  function formatter_linkDevice(value, row, index) {
    var html = '<i class="fa fa-check" style="color:#090;" aria-hidden="true"></i>';
    var step = !!row.status ? 2 : 1;
    if (!value) {
      html = '<button type="button" class="btn btn-primary js-link" '
        + 'data-i18n="webduinoDevice.fieldBtn.verify" ' 
        + 'data-toggle="modal" data-target=".js-modal-linkDevice-step' + step + '"></button>';
      html = $(html).i18n()[0].outerHTML;
    }
    return html;
  }

  function deviceTypeFormatter(value, row, index) {
    if (!value) {
      return value;
    }
    return i18n.t('other.product.' + value);
  }

  function statusFormatter(value, row, index) {
    var icon = '';
    if (value) {
      return '<i class="icon-power-on" aria-hidden="true" style="color:#090; font-size:20px;" title="Device on-line"></i>';
    } else {
      return '<i class="icon-power-off" aria-hidden="true" style="color:#c33; font-size:20px;" title="Device off-line"></i>';
    }
  }

  function notify(options, settings) {
    var option = $.extend({
      icon: 'fa fa-check-circle fa-lg',
      message: ''
    }, options);

    var setting = $.extend({
      newest_on_top: true,
      type: 'success',
      delay: 3000,
      placement: {
        align: 'center'
      }
    }, settings || {});

    $.notify(option, setting);
  }

  function getProgressBar(selectors) {
    var $progressbar = $(selectors).find('.progress .progress-bar').first();

    return {
      progress: function(val) {
        $progressbar.attr('data-transitiongoal', val).progressbar();
      },
      reset: function() {
        this.progress(0);
      }
    };
  }

  function getLocationSearch() {
    var vars = [];
    var hashes = location.search.slice(1).split('&');
    var hash;

    for (var i = 0; i < hashes.length; i++) {
      hash = hashes[i].split('=');
      vars.push(hash[0]);
      vars[hash[0]] = hash[1];
    }
    return vars;
  }

  function updateLanguageValue() {
    var lang = getLocationSearch()['lang'] || 'zh_tw';
    var $lang = $('#language');

    $lang.find('option').each(function (idx, ele) {
      if (ele.value === lang) {
        ele.setAttribute('selected', true);
        return false;
      }
    });

    $lang.show();
  }

  function initI18n(callback) {
    i18n.init({
      lng: getLocationSearch()['lang'] || 'zh_tw',
      resGetPath: 'locales/__lng__.json',
      lowerCaseLng: true,
      fallbackLng: 'zh_tw',
      preload: ["en", "zh_tw"],
      ns: {
        namespaces: ["translation"],
        defaultNs: "translation"
      },
      useLocalStorage: false
    }, function () {
      $("body").i18n();
      callback();
    });
  }

})();
